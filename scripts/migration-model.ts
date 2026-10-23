import { Decimal } from 'decimal.js';
import type { Transaction } from '../src/core/types.js';
import { javaDecimalText } from '../src/core/json.js';
import { canonicalTimestamp } from '../src/core/time.js';

type Row = Record<string, unknown>;
const string = (value: unknown) => value == null ? null : String(value);
const number = (value: unknown) => value == null ? null : Number(value);
function decimal(value: unknown): string | null { return value == null ? null : javaDecimalText(String(value)); }

export function validateTransaction(value: unknown): asserts value is Transaction {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Transacción inválida');
  const row = value as Record<string, unknown>;
  const int32 = (item: unknown) => typeof item === 'number' && Number.isInteger(item) && item >= -2147483648 && item <= 2147483647;
  if (typeof row.uid !== 'string' || !row.uid || !int32(row.branchId)
    || ['couponFolio', 'orderNumber', 'itemRequest'].some(field => row[field] !== null && typeof row[field] !== 'string')
    || ['countryId', 'brandId', 'orderTypeId', 'ticketId', 'paymentMethodId', 'employeeId'].some(field => row[field] !== null && !int32(row[field]))
    || row.redemptionToken !== null && typeof row.redemptionToken !== 'string'
    || !Array.isArray(row.payments) || !row.payments.every(int32)
    || !Number.isSafeInteger(row.version) || Number(row.version) < 0) throw new Error('Transacción incompleta');
  for (const field of ['discount', 'totalAmountWithoutDiscount', 'totalAmount']) {
    const item = row[field];
    if (item === null) continue;
    if (typeof item !== 'string' || !new Decimal(javaDecimalText(item)).isFinite()) throw new Error('Importe de transacción inválido');
  }
  for (const field of ['validationDate', 'redemptionDate']) {
    const item = row[field];
    if (item === null) continue;
    if (typeof item !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3,9}Z$/.test(item)
      || canonicalTimestamp(item) !== item.replace(/\.(\d+)Z$/, (_, fraction: string) => `.${fraction.padEnd(9, '0')}Z`)) throw new Error('Fecha de transacción inválida');
  }
}
/** SQL datetime carece de zona: interpretar explícitamente, nunca usar la zona del equipo. */
export function sqlDate(value: unknown, zone: string): string | null {
  if (value == null) return null;
  const text = value instanceof Date ? value.toISOString() : String(value);
  if (typeof value === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(text)) return canonicalTimestamp(text);
  const match = /^(\d{4})-(\d\d)-(\d\d)[T ](\d\d):(\d\d):(\d\d)(?:\.(\d+))?/.exec(text);
  if (!match) throw new Error('Fecha SQL inválida');
  const [, year, month, day, hour, minute, second, fraction] = match;
  const wallClock = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second), Number((fraction ?? '').slice(0, 3).padEnd(3, '0')));
  const format = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' });
  let instant = wallClock;
  for (let iteration = 0; iteration < 3; iteration++) {
    const offset = format.formatToParts(new Date(instant)).find(part => part.type === 'timeZoneName')?.value ?? 'GMT';
    const parts = /GMT([+-])(\d\d):(\d\d)/.exec(offset);
    const minutes = parts ? (Number(parts[2]) * 60 + Number(parts[3])) * (parts[1] === '-' ? -1 : 1) : 0;
    instant = wallClock - minutes * 60_000;
  }
  if ((fraction?.length ?? 0) > 9) throw new Error('Precisión SQL no compatible');
  return `${new Date(instant).toISOString().slice(0, 19)}.${(fraction ?? '').padEnd(9, '0')}Z`;
}
export function mapSql(row: Row, payments: number[], zone: string): Transaction {
  // No convertir NULL a 0 ni a la cadena "null" en campos que identifican accesos.
  if (['FIUID', 'FISUCURSALID'].some(field => row[field] == null)) throw new Error('Transacción SQL incompleta');
  const transaction: Transaction = {
    uid: String(row.FIUID), countryId: number(row.FIPAISID), brandId: number(row.FIMARCAID), branchId: Number(row.FISUCURSALID),
    ticketId: number(row.FITICKETID), orderTypeId: number(row.FITIPOORDENID), paymentMethodId: number(row.FIMETODOPAGOID), employeeId: number(row.FIEMPLEADOID),
    couponFolio: string(row.FCFOLIOCUPONID), orderNumber: string(row.FCORDERNUM), redemptionToken: string(row.FCTOKENREDENCION), itemRequest: string(row.FCITEMREQUEST),
    totalAmountWithoutDiscount: decimal(row.FNMONTOTOTALSINDESCUENTO), totalAmount: decimal(row.FNMONTOTOTAL), discount: decimal(row.FNDESCUENTO),
    validationDate: sqlDate(row.FDFECHAVALIDATE, zone), redemptionDate: sqlDate(row.FDFECHAREDEEM, zone), payments, version: 0,
  };
  validateTransaction(transaction);
  return transaction;
}
