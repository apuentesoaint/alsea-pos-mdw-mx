import { legacyRuntime } from '../core/legacy-errors.js';
import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand, PutCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { RedeemRequest, StoreRequest, Transaction, TransactionRepository } from '../core/types.js';
import { persistence, technical } from '../core/errors.js';
import { javaInteger } from '../core/validation.js';
import { log, metric } from '../core/logging.js';
import { awsSignal } from '../core/deadline.js';
import { canonicalTimestamp } from '../core/time.js';

const component = (value: string | number) => encodeURIComponent(String(value));
export const transactionKey = (uid: string, branch: number) => ({ PK: `TX#${component(uid)}#STORE#${branch}`, SK: 'META' });
export const pendingKey = (transaction: Transaction) => ({
  PK: `${transaction.couponFolio === null ? 'COUPON-NULL' : 'COUPON'}#${transaction.countryId}#${transaction.brandId}#${transaction.branchId}#${component(transaction.couponFolio ?? '')}`,
  SK: `VALIDATED#${transaction.validationDate === null ? '!NULL' : canonicalTimestamp(transaction.validationDate)}#${component(transaction.uid)}`,
});
export function applyRedemption(transaction: Transaction, request: RedeemRequest): Transaction {
  const ticketId = javaInteger(request.ticketId);
  // El Java desempaqueta Integer en setInt y falla si employeID es nulo.
  if (request.employeID == null) throw legacyRuntime('employeeNull');
  const split = request.paymentMethodId.split(',');
  while (split.length > 1 && split.at(-1) === '') split.pop();
  const payments = split.map(javaInteger);
  return { ...transaction, ticketId, paymentMethodId: 0, employeeId: request.employeID,
    totalAmountWithoutDiscount: String(request.totalOrderWithOutDiscount), totalAmount: String(request.totalOrder),
    redemptionDate: new Date().toISOString(), payments, version: transaction.version + 1 };
}
export class DynamoTransactions implements TransactionRepository {
  constructor(private readonly table: string, private readonly bucket: string,
    private readonly db = DynamoDBDocumentClient.from(new DynamoDBClient({ maxAttempts: 3, requestHandler: { connectionTimeout: 1000, requestTimeout: 5000 } }), { marshallOptions: { removeUndefinedValues: true } }),
    private readonly s3 = new S3Client({ maxAttempts: 3, requestHandler: { connectionTimeout: 1000, requestTimeout: 5000 } })) {}
  async save(transaction: Transaction): Promise<void> {
    let uploaded: { key: string; version?: string } | undefined;
    try {
      const key = transactionKey(transaction.uid, transaction.branchId);
      let detail: Record<string, unknown> = { value: transaction.itemRequest };
      if (transaction.itemRequest !== null && Buffer.byteLength(transaction.itemRequest, 'utf8') > 300 * 1024) {
        const objectKey = `details/${component(transaction.uid)}/${transaction.branchId}/${randomUUID()}.json`;
        const result = await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: objectKey, Body: transaction.itemRequest, ContentType: 'application/json', ServerSideEncryption: 'AES256' }), { abortSignal: awsSignal() });
        uploaded = { key: objectKey, version: result.VersionId };
        detail = { objectKey, objectVersion: result.VersionId };
      }
      const { itemRequest: _, ...metadata } = transaction;
      await this.db.send(new TransactWriteCommand({ ClientRequestToken: randomUUID(), TransactItems: [
        { Put: { TableName: this.table, Item: { ...key, ...metadata }, ConditionExpression: 'attribute_not_exists(PK)' } },
        { Put: { TableName: this.table, Item: { ...key, SK: 'PAYLOAD', ...detail }, ConditionExpression: 'attribute_not_exists(PK)' } },
        ...(transaction.redemptionDate === null ? [{ Put: { TableName: this.table,
          Item: { ...pendingKey(transaction), uid: transaction.uid, branchId: transaction.branchId, validationDate: transaction.validationDate, redemptionDate: null },
          ConditionExpression: 'attribute_not_exists(PK)' } }] : []),
      ] }), { abortSignal: awsSignal() });
      log('info', 'persistence.completed', { operation: 'save' });
    } catch (cause) {
      // Un timeout puede ocultar un commit exitoso. Borrar el detalle en ese caso dañaría datos válidos.
      const definitiveFailure = cause instanceof Error && ['TransactionCanceledException', 'ValidationException'].includes(cause.name);
      if (uploaded && definitiveFailure && uploaded.version) {
        try { await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: uploaded.key, VersionId: uploaded.version }), { abortSignal: awsSignal() }); } catch { metric('OrphanPayloads'); }
      } else if (uploaded) metric('OrphanPayloads');
      metric('PersistenceErrors'); throw persistence(cause);
    }
  }
  async get(uid: string, branchId: number): Promise<Transaction | undefined> {
    try {
      const key = transactionKey(uid, branchId);
      const response = await this.db.send(new GetCommand({ TableName: this.table, Key: key, ConsistentRead: true }), { abortSignal: awsSignal() });
      if (!response.Item) return undefined;
      const detail = await this.db.send(new GetCommand({ TableName: this.table, Key: { ...key, SK: 'PAYLOAD' }, ConsistentRead: true }), { abortSignal: awsSignal() });
      if (!detail.Item) throw new Error('Detalle de transacción ausente');
      let itemRequest = detail.Item.value;
      if (detail.Item?.objectKey) {
        const object = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: detail.Item.objectKey, VersionId: detail.Item.objectVersion }), { abortSignal: awsSignal() });
        if (!object.Body) throw new Error('Detalle S3 ausente');
        itemRequest = await object.Body.transformToString();
      }
      if (itemRequest !== null && typeof itemRequest !== 'string') throw new Error('Detalle de transacción inválido');
      return { ...response.Item, itemRequest } as Transaction;
    } catch (cause) { metric('PersistenceErrors'); throw persistence(cause); }
  }
  async latest(countryId: number, brandId: number, branchId: number, couponCode: string): Promise<Pick<Transaction, 'uid' | 'redemptionDate'> | undefined> {
    try {
      const PK = `COUPON#${countryId}#${brandId}#${branchId}#${component(couponCode)}`;
      const response = await this.db.send(new QueryCommand({ TableName: this.table, ConsistentRead: true,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)', ExpressionAttributeValues: { ':pk': PK, ':prefix': 'VALIDATED#' }, ScanIndexForward: false, Limit: 1 }), { abortSignal: awsSignal() });
      return response.Items?.[0] as Pick<Transaction, 'uid' | 'redemptionDate'> | undefined;
    } catch (cause) { metric('PersistenceErrors'); throw persistence(cause); }
  }
  async redeem(transaction: Transaction, request: RedeemRequest): Promise<void> {
    let current = transaction;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const updated = applyRedemption(current, request);
      const { itemRequest: _, ...metadata } = updated;
      try {
        await this.db.send(new TransactWriteCommand({ ClientRequestToken: randomUUID(), TransactItems: [
          { Put: { TableName: this.table, Item: { ...transactionKey(current.uid, current.branchId), ...metadata },
            ConditionExpression: 'attribute_exists(PK) AND #version = :version', ExpressionAttributeNames: { '#version': 'version' }, ExpressionAttributeValues: { ':version': current.version } } },
          { Delete: { TableName: this.table, Key: pendingKey(current) } },
        ] }), { abortSignal: awsSignal() });
        log('info', 'persistence.completed', { operation: 'redeem' }); return;
      } catch (cause) {
        const cancellation = cause as { name?: string; CancellationReasons?: { Code?: string }[] };
        const conflict = cancellation.name === 'TransactionCanceledException' && cancellation.CancellationReasons?.some(reason => ['ConditionalCheckFailed', 'TransactionConflict'].includes(reason.Code ?? ''));
        if (conflict && attempt < 3) {
          const latest = await this.get(transaction.uid, transaction.branchId);
          if (latest) { current = latest; await new Promise(resolve => setTimeout(resolve, 20 * attempt)); continue; }
        }
        metric('PersistenceErrors'); throw persistence(cause);
      }
    }
  }
  async attempt(uid: string, branchId: number, requestId: string, state: 'started' | 'external-success' | 'committed' | 'uncertain'): Promise<void> {
    try {
      await this.db.send(new PutCommand({ TableName: this.table, Item: { ...transactionKey(uid, branchId), SK: `ATTEMPT#${component(requestId)}`, state, updatedAt: new Date().toISOString() } }), { abortSignal: awsSignal() });
    } catch (cause) { metric('PersistenceErrors'); throw persistence(cause); }
    if (state === 'uncertain') metric('UncertainRedemptions');
  }
  async saveStore(store: StoreRequest): Promise<{ storeKey: string }> {
    try {
      const storeKey = `stores/country_${store.countryId}/brand_${store.brandId}/store_${store.storeId}.json`;
      const storeData = JSON.stringify({ ...store, updatedAt: new Date().toISOString() }, null, 2);
      await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: storeKey, Body: storeData, ContentType: 'application/json', ServerSideEncryption: 'AES256' }), { abortSignal: awsSignal() });

      const catalogKey = 'stores/catalog.json';
      let catalog: Record<string, unknown>[] = [];
      try {
        const existing = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: catalogKey }), { abortSignal: awsSignal() });
        if (existing.Body) {
          const bodyStr = await existing.Body.transformToString();
          catalog = JSON.parse(bodyStr);
        }
      } catch { catalog = []; }

      const storeIdKey = `${store.countryId}-${store.brandId}-${store.storeId}`;
      const index = catalog.findIndex(item => `${item.countryId}-${item.brandId}-${item.storeId}` === storeIdKey);
      const updatedEntry = { ...store, storeKey, updatedAt: new Date().toISOString() };
      if (index >= 0) { catalog[index] = updatedEntry; } else { catalog.push(updatedEntry); }

      await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: catalogKey, Body: JSON.stringify(catalog, null, 2), ContentType: 'application/json', ServerSideEncryption: 'AES256' }), { abortSignal: awsSignal() });
      log('info', 'persistence.completed', { operation: 'saveStore', storeKey });
      return { storeKey };
    } catch (cause) { metric('PersistenceErrors'); throw persistence(cause); }
  }
}
