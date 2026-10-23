import { legacyRuntime } from '../core/legacy-errors.js';
import { randomUUID } from 'node:crypto';
import { Decimal } from 'decimal.js';
import type { CouponProvider, GenerateRequest, RedeemRequest, Transaction, TransactionRepository, ValidateRequest } from '../core/types.js';
import { business, messages, technical } from '../core/errors.js';
import { evaluateDiscount, remapResult } from './discounts.js';
import { requestContext, metric, logError } from '../core/logging.js';
import { javaInteger } from '../core/validation.js';
import { javaDecimalText, stringify } from '../core/json.js';

const brands: Record<number, string> = { 10: 'SBX', 11: 'BK', 12: 'CHI', 13: 'IT', 14: 'CPK', 15: 'PF', 16: 'CCF', 17: 'OVI', 18: 'POR', 19: 'DOP', 20: 'FIN', 21: 'AL', 60: 'CH' };
export function generatedUid(branchId: number, brandId: number, now = Date.now()): string {
  return `UID${String(branchId).padStart(5, '0')}${brands[brandId] ?? '-'}${now.toString(36).toUpperCase()}`;
}
/** Gson omite nulos y List.toString separa elementos con coma y espacio. */
function javaItems(request: ValidateRequest): string {
  if (request.itemsOrder == null) return '';
  const ordered = (source: Record<string, unknown>, fields: string[]): Record<string, unknown> => Object.fromEntries(fields.flatMap(key => {
    const value = source[key];
    if (value == null) return [];
    if (key === 'amount') {
      return [[key, JSON.rawJSON(javaDecimalText(String(value)))]];
    }
    if (key === 'modifiers') return [[key, (value as (Record<string, unknown> | null)[]).map(modifier => modifier === null ? null : ordered(modifier, ['modifierId', 'modifierName', 'familyId', 'quantity', 'amount', 'comment', 'modifiers']))]];
    return [[key, value]];
  }));
  return `[${request.itemsOrder.map(item => item === null ? 'null' : stringify(ordered(item as unknown as Record<string, unknown>, ['idItem', 'typeItem', 'nameItem', 'familyId', 'quantity', 'amount', 'comment', 'modifiers', 'descart', 'multivalue', 'priceLevel']))
    .replace(/[<>&=']/g, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`)).join(', ')}]`;
}
export class Coupons {
  constructor(private readonly repository: TransactionRepository, private readonly provider: CouponProvider,
    private readonly now = () => Date.now(), private readonly uuid = randomUUID) {}
  async validate(request: ValidateRequest) {
    if (request.brandId === 20) request.brandId = 60;
    const uid = generatedUid(request.storeId, request.brandId, this.now());
    const external = await this.provider.validate(request, uid);
    const evaluation = evaluateDiscount(request, external);
    if (evaluation.result === null) return { uid, message: 'Cupón no definido', data: null };
    const result = evaluation.result;
    const transaction: Transaction = {
      uid: external.fcUID!, countryId: request.countryId, brandId: request.brandId, branchId: request.storeId,
      ticketId: null, orderTypeId: javaInteger(request.typeOrder), paymentMethodId: null, employeeId: null,
      couponFolio: external.cupon.fcFolioCuponID, orderNumber: String(request.orderNumber), redemptionToken: external.fcTokenRedencion,
      itemRequest: javaItems(request), totalAmountWithoutDiscount: null, totalAmount: null,
      discount: new Decimal(result.totalDiscount as Decimal.Value).toFixed(), validationDate: new Date(this.now()).toISOString(),
      redemptionDate: null, payments: [], version: 0,
    };
    await this.repository.save(transaction);
    if (evaluation.rejectAfterSave()) throw business('Items/Familia no participantes');
    remapResult(result, request, external);
    return { uid, message: 'OK.', data: result };
  }
  async redeem(request: RedeemRequest) {
    if (request.brandId === 20) request.brandId = 60;
    const transaction = await this.repository.get(request.uid, request.storeId);
    if (!transaction) throw business(messages.notValidated);
    if (transaction.discount === null) throw legacyRuntime('transactionDiscountNull');
    if (!new Decimal(transaction.discount).eq(request.totalDiscountOrder)) throw business(messages.discountMismatch);
    const requestId = requestContext.getStore()?.requestId ?? this.uuid();
    await this.repository.attempt(request.uid, request.storeId, requestId, 'started');
    let externalSucceeded = false;
    try {
      const response = await this.provider.redeem(request, transaction);
      if (response.folioCuponId == null) throw legacyRuntime('couponIdNull');
      if (response.folioCuponId === '') {
        await this.repository.attempt(request.uid, request.storeId, requestId, 'committed');
        return { uid: request.uid, message: 'OK.', data: { code: '010' } };
      }
      externalSucceeded = true;
      await this.repository.attempt(request.uid, request.storeId, requestId, 'external-success');
      await this.repository.redeem(transaction, request);
      // Un fallo del registro diagnóstico después del commit no debe convertir un canje exitoso en fallo.
      try { await this.repository.attempt(request.uid, request.storeId, requestId, 'committed'); }
      catch (error) { logError(error, 'redemption.commit-journal'); metric('UncertainRedemptions'); }
      return { uid: request.uid, message: 'OK.', data: { code: '000' } };
    } catch (error) {
      // Un timeout del proveedor también puede ocultar un canje ya realizado.
      try { await this.repository.attempt(request.uid, request.storeId, requestId, 'uncertain'); }
      catch (journalError) { logError(journalError, 'redemption.uncertain-journal'); metric('UncertainRedemptions'); }
      if (externalSucceeded) metric('ExternalSuccessPersistenceFailure');
      throw error;
    }
  }
  async generate(request: GenerateRequest) { return { uid: this.uuid(), message: 'OK.', data: await this.provider.generate(request) }; }
  async latest(country: number, brand: number, store: number, coupon: string) {
    const transaction = await this.repository.latest(country, brand, store, coupon);
    return transaction ? { uid: transaction.uid, message: 'OK.', data: { uid: transaction.uid, redeemed: transaction.redemptionDate != null } }
      : { uid: null, message: 'No se encontró transacción', data: null };
  }
}
