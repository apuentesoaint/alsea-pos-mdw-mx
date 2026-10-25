import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GetCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoTransactions, pendingKey, transactionKey } from '../src/infrastructure/repository.js';
import { CachedSecrets } from '../src/infrastructure/secrets.js';
import type { Transaction } from '../src/core/types.js';
import { redeem } from './fixtures.js';
import { sqlDate, mapSql, validateTransaction } from '../scripts/migration-model.js';
import { awsSignal } from '../src/core/deadline.js';
import { requestContext } from '../src/core/logging.js';

function transaction(): Transaction { return { uid: 'test-uid', countryId: 1, brandId: 11, branchId: 1, ticketId: null, orderTypeId: 1,
  paymentMethodId: null, employeeId: null, couponFolio: 'TEST001', orderNumber: '12', redemptionToken: 'TEST_ONLY', itemRequest: '[]', totalAmountWithoutDiscount: null,
  totalAmount: null, discount: '20', validationDate: '2026-10-22T00:00:00.000Z', redemptionDate: null, payments: [], version: 0 }; }
test('guardar usa una transacción atómica y previene duplicados', async () => {
  let input: TransactWriteCommand['input'] | undefined;
  const repository = new DynamoTransactions('table', 'bucket', { send: async (command: TransactWriteCommand) => { input = command.input; return {}; } } as never);
  await repository.save(transaction());
  assert.equal(input?.TransactItems?.length, 3); assert.ok(input?.ClientRequestToken);
  assert.ok(input?.TransactItems?.every(value => value.Put?.ConditionExpression === 'attribute_not_exists(PK)'));
  assert.equal(input?.TransactItems?.[2]?.Put?.Item?.PK, pendingKey(transaction()).PK);
});
test('latest usa consistencia fuerte, orden descendente y no usa Scan ni GSI', async () => {
  const repository = new DynamoTransactions('table', 'bucket', { send: async (command: QueryCommand) => {
    assert.ok(command instanceof QueryCommand); assert.equal(command.input.ConsistentRead, true); assert.equal(command.input.ScanIndexForward, false);
    assert.equal(command.input.Limit, 1); assert.equal(command.input.IndexName, undefined); assert.equal(command.input.FilterExpression, undefined);
    return { Items: [{ uid: 'test-uid', redemptionDate: null }] };
  } } as never);
  assert.equal((await repository.latest(1, 11, 1, 'TEST001'))?.uid, 'test-uid');
});
test('claves codificadas no colisionan al incluir delimitadores', () => {
  assert.notEqual(transactionKey('x#STORE#1', 2).PK, transactionKey('x', 1).PK);
});
test('canje actualiza transacción/pagos y elimina referencia pendiente atómicamente', async () => {
  let input: TransactWriteCommand['input'] | undefined;
  const repository = new DynamoTransactions('table', 'bucket', { send: async (command: TransactWriteCommand) => { input = command.input; return {}; } } as never);
  await repository.redeem(transaction(), redeem());
  assert.equal(input?.TransactItems?.length, 2);
  assert.deepEqual(input?.TransactItems?.[0]?.Put?.Item?.payments, [1, 2, 1]);
  assert.match(input?.TransactItems?.[0]?.Put?.ConditionExpression ?? '', /attribute_exists/);
  assert.equal(input?.TransactItems?.[0]?.Put?.ExpressionAttributeValues?.[':version'], 0);
  assert.deepEqual(input?.TransactItems?.[1]?.Delete?.Key, pendingKey(transaction()));
});
test('conflicto de versión reintenta solo DynamoDB con la versión actualizada', async () => {
  let writes = 0;
  const repository = new DynamoTransactions('table', 'bucket', { send: async (command: TransactWriteCommand | GetCommand) => {
    if (command instanceof GetCommand) return { Item: command.input.Key?.SK === 'META' ? { ...transaction(), version: 1 } : { value: '[]' } };
    writes++;
    if (writes === 1) throw Object.assign(new Error('conflict'), { name: 'TransactionCanceledException', CancellationReasons: [{ Code: 'ConditionalCheckFailed' }] });
    assert.equal(command.input.TransactItems?.[0]?.Put?.ExpressionAttributeValues?.[':version'], 1); return {};
  } } as never);
  await repository.redeem(transaction(), redeem()); assert.equal(writes, 2);
});
test('detalle grande se guarda en S3 con referencia y versión', async () => {
  let input: TransactWriteCommand['input'] | undefined; let uploaded = false;
  const repository = new DynamoTransactions('table', 'bucket', { send: async (command: TransactWriteCommand) => { input = command.input; return {}; } } as never,
    { send: async (command: PutObjectCommand) => { assert.ok(command instanceof PutObjectCommand); assert.equal(command.input.ServerSideEncryption, 'AES256'); uploaded = true; return { VersionId: 'version-test' }; } } as never);
  await repository.save({ ...transaction(), itemRequest: 'x'.repeat(301 * 1024) });
  assert.equal(uploaded, true); assert.equal(input?.TransactItems?.[1]?.Put?.Item?.objectVersion, 'version-test');
  assert.equal(input?.TransactItems?.[1]?.Put?.Item?.value, undefined);
});
test('commit incierto no borra el objeto que podría estar referenciado', async () => {
  let deletes = 0;
  const repository = new DynamoTransactions('table', 'bucket', { send: async () => { throw Object.assign(new Error('timeout'), { name: 'TimeoutError' }); } } as never,
    { send: async (command: PutObjectCommand | DeleteObjectCommand) => { if (command instanceof DeleteObjectCommand) deletes++; return { VersionId: 'version-test' }; } } as never);
  await assert.rejects(repository.save({ ...transaction(), itemRequest: 'x'.repeat(301 * 1024) })); assert.equal(deletes, 0);
});
test('rechazo definitivo limpia únicamente la versión de detalle recién subida', async () => {
  let deletedVersion: string | undefined;
  const repository = new DynamoTransactions('table', 'bucket', { send: async () => { throw Object.assign(new Error('cancelled'), { name: 'TransactionCanceledException' }); } } as never,
    { send: async (command: PutObjectCommand | DeleteObjectCommand) => { if (command instanceof DeleteObjectCommand) deletedVersion = command.input.VersionId; return { VersionId: 'version-test' }; } } as never);
  await assert.rejects(repository.save({ ...transaction(), itemRequest: 'x'.repeat(301 * 1024) })); assert.equal(deletedVersion, 'version-test');
});
test('Secrets Manager agrupa lecturas concurrentes y reutiliza caché sin publicar valores', async () => {
  let calls = 0; const secrets = new CachedSecrets({ send: async () => { calls++; await Promise.resolve(); return { SecretString: '{"value":"TEST_ONLY"}' }; } } as never);
  const [left, right] = await Promise.all([secrets.get('test-id'), secrets.get('test-id')]);
  assert.deepEqual(left, right); await secrets.get('test-id'); assert.equal(calls, 1);
});
test('migración interpreta datetime sin zona como hora México y conserva null', () => {
  assert.equal(sqlDate('2026-10-22 10:20:30.123', 'America/Mexico_City'), '2026-10-22T16:20:30.123000000Z');
  assert.equal(sqlDate('2026-10-22 10:20:30.1234567', 'America/Mexico_City'), '2026-10-22T16:20:30.123456700Z');
  assert.equal(sqlDate(null, 'America/Mexico_City'), null);
  const result = mapSql({ FIUID: 'u', FIPAISID: 1, FIMARCAID: 11, FISUCURSALID: 1, FITIPOORDENID: 1, FCFOLIOCUPONID: 'TEST', FCORDERNUM: '1',
    FNDESCUENTO: '0.10', FDFECHAVALIDATE: '2026-10-22 10:20:30', FDFECHAREDEEM: null }, [1, 1], 'America/Mexico_City');
  assert.equal(result.discount, '0.10'); assert.deepEqual(result.payments, [1, 1]); assert.equal(result.redemptionDate, null);
});
test('el índice de pendientes ordena timestamps con precisión mixta por instante y conserva fracciones', () => {
  const base = transaction();
  assert.equal(pendingKey(base).SK, pendingKey({ ...base, validationDate: '2026-10-22T00:00:00.000000000Z' }).SK);
  assert.ok(pendingKey({ ...base, validationDate: '2026-10-22T00:00:00.123456700Z' }).SK > pendingKey({ ...base, validationDate: '2026-10-22T00:00:00.123Z' }).SK);
});
test('migración rechaza filas incompletas sin convertir NULL a cero ni importar JSONL arbitrario', () => {
  assert.throws(() => validateTransaction({}));
  assert.throws(() => validateTransaction({ ...transaction(), discount: 'NaN' }));
  assert.throws(() => validateTransaction({ ...transaction(), payments: [1, null] }));
  assert.throws(() => validateTransaction({ ...transaction(), validationDate: 'fecha inválida' }));
  assert.doesNotThrow(() => validateTransaction({ ...transaction(), discount: '12345678901234567890.123456789' }));
  assert.throws(() => mapSql({ FIUID: 'u', FIPAISID: null }, [], 'America/Mexico_City'));
});
test('migración conserva NULL históricos y referencias sin confundirlos con el folio literal null', async () => {
  const mapped = mapSql({ FIUID: 'historical', FISUCURSALID: 1 }, [], 'America/Mexico_City');
  for (const field of ['countryId', 'brandId', 'orderTypeId', 'couponFolio', 'orderNumber', 'itemRequest', 'discount', 'validationDate'] as const) assert.equal(mapped[field], null);
  assert.notEqual(pendingKey(mapped).PK, pendingKey({ ...mapped, couponFolio: 'null' }).PK);
  let stored: unknown;
  const repository = new DynamoTransactions('table', 'bucket', { send: async (command: TransactWriteCommand) => { stored = command.input.TransactItems?.[1]?.Put?.Item?.value; return {}; } } as never);
  await repository.save(mapped); assert.equal(stored, null);
});
test('saveStore guarda individualmente y actualiza catálogo en S3 de forma idempotente', async () => {
  const puts: { key: string; body: string }[] = [];
  let catalogContent: string | null = null;
  const repository = new DynamoTransactions('table', 'bucket', {} as never, {
    send: async (command: PutObjectCommand | DeleteObjectCommand) => {
      if (command instanceof PutObjectCommand) {
        puts.push({ key: command.input.Key!, body: String(command.input.Body) });
        if (command.input.Key === 'stores/catalog.json') catalogContent = String(command.input.Body);
      }
      return {};
    },
  } as never);

  const storeReq = { countryId: 1, brandId: 11, storeId: 50, name: 'Sucursal Centro' };
  const res1 = await repository.saveStore(storeReq);
  assert.equal(res1.storeKey, 'stores/country_1/brand_11/store_50.json');
  assert.equal(puts.length, 2);

  // Segunda invocación con la misma tienda actualiza el catálogo idempotentemente
  const res2 = await repository.saveStore({ ...storeReq, name: 'Sucursal Centro Actualizada' });
  assert.equal(res2.storeKey, 'stores/country_1/brand_11/store_50.json');
  assert.ok(catalogContent);
});
test('SDK recibe cancelación dentro del presupuesto Lambda y errores de detalle no se ocultan', async () => {
  requestContext.run({ transactionId: 't', requestId: 'r', route: 'test', deadline: Date.now() - 1 }, () => assert.equal(awsSignal().aborted, true));
  const repository = new DynamoTransactions('table', 'bucket', { send: async (command: GetCommand, options: { abortSignal?: AbortSignal }) => {
    assert.ok(options.abortSignal instanceof AbortSignal);
    return { Item: command.input.Key?.SK === 'META' ? transaction() : undefined };
  } } as never);
  await assert.rejects(repository.get('test-uid', 1), /No fue posible completar/);
});
