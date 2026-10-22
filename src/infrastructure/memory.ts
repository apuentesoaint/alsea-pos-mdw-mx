import type { RedeemRequest, Transaction, TransactionRepository } from '../core/types.js';
import { persistence } from '../core/errors.js';
import { applyRedemption, pendingKey, transactionKey } from './repository.js';

/** Adaptador exclusivo de pruebas y desarrollo local: jamás se selecciona en Lambda. */
export class MemoryTransactions implements TransactionRepository {
  readonly records = new Map<string, Transaction>();
  readonly attempts = new Map<string, string>();
  private key(uid: string, branchId: number): string { return transactionKey(uid, branchId).PK; }
  async save(transaction: Transaction): Promise<void> {
    const key = this.key(transaction.uid, transaction.branchId);
    if (this.records.has(key)) throw persistence(new Error('UID duplicado'));
    this.records.set(key, structuredClone(transaction));
  }
  async get(uid: string, branchId: number): Promise<Transaction | undefined> {
    const transaction = this.records.get(this.key(uid, branchId));
    return transaction && structuredClone(transaction);
  }
  async latest(country: number, brand: number, branch: number, coupon: string): Promise<Transaction | undefined> {
    const record = [...this.records.values()].filter(value => value.countryId === country && value.brandId === brand && value.branchId === branch && value.couponFolio === coupon && value.redemptionDate === null)
      .sort((a, b) => pendingKey(b).SK.localeCompare(pendingKey(a).SK))[0];
    return record && structuredClone(record);
  }
  async redeem(transaction: Transaction, request: RedeemRequest): Promise<void> {
    const key = this.key(transaction.uid, transaction.branchId);
    if (this.records.get(key)?.version !== transaction.version) throw persistence(new Error('Conflicto de versión'));
    this.records.set(key, applyRedemption(transaction, request));
  }
  async attempt(uid: string, branch: number, request: string, state: string): Promise<void> { this.attempts.set(`${uid}:${branch}:${request}`, state); }
}
