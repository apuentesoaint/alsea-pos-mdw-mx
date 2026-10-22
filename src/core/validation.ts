import { Decimal } from 'decimal.js';
import { AppError, messages } from './errors.js';
import { javaDecimalText, parseJson } from './json.js';
import type { GenerateRequest, RedeemRequest, ValidateRequest } from './types.js';

type Rule = { type: 'integer' | 'string' | 'amount' | 'object'; nullable?: boolean; blank?: boolean; digits?: number; positive?: boolean; length?: number; trimmed?: boolean; fields?: Record<string, Rule> };
const positive = (digits: number): Rule => ({ type: 'integer', digits, positive: true });
const text: Rule = { type: 'string', blank: true, length: 10, trimmed: true };
const amount: Rule = { type: 'amount' };
const common: Record<string, Rule> = { countryId: positive(2), brandId: positive(2), storeId: positive(8) };
const schemas: Record<string, Record<string, Rule>> = {
  auth: { clientId: { type: 'string', blank: true, trimmed: true }, clientSecret: { type: 'string', blank: true, trimmed: true } },
  validate: { ...common, posId: positive(8), orderNumber: positive(10), couponCode: text, typeOrder: text, totalOrder: amount },
  redeem: { ...common, posID: { type: 'string', digits: 8, positive: true }, couponCode: text, typeOrder: text,
    paymentMethodId: { type: 'string' }, totalOrderWithOutDiscount: amount, totalOrder: amount, totalDiscountOrder: amount,
    employeID: { ...positive(8), nullable: true }, ticketId: { type: 'string' }, fechaCanje: { type: 'string' }, uid: { type: 'string' }, nombreColaborador: { type: 'string', nullable: true } },
  generate: {
    request: { type: 'object', fields: { campaign_id: { type: 'string', blank: true }, coupon_type: positive(2),
      broadcast_channel: { type: 'string', blank: true }, brandId: positive(2), countryId: positive(2) } },
    customer: { type: 'object', fields: { id: { type: 'string', blank: true }, name: { type: 'string', blank: true }, phoneCode: { type: 'string', nullable: true }, phone: { type: 'string', nullable: true } } },
  },
};
function object(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function deserialize(value: Record<string, unknown>, rules: Record<string, Rule>): Record<string, unknown> {
  const result = { ...value };
  for (const [key, rule] of Object.entries(rules)) {
    const item = value[key];
    if (item === undefined || item === null) continue;
    if (rule.type === 'object') {
      if (!object(item)) throw new AppError('validation', messages.json);
      result[key] = deserialize(item, rule.fields ?? {});
    } else if (rule.type === 'integer') {
      if (typeof item === 'string' && ['', 'null'].includes(item.trim())) { result[key] = null; continue; }
      if (!['number', 'string'].includes(typeof item) || (typeof item === 'string' && !/^[+-]?\d+$/.test(item.trim()))) throw new AppError('validation', messages.json);
      const number = Math.trunc(Number(item));
      if (!Number.isInteger(number) || number < -2147483648 || number > 2147483647) throw new AppError('validation', messages.json);
      result[key] = number;
    } else if (rule.type === 'string') {
      if (typeof item === 'object') throw new AppError('validation', messages.json);
      result[key] = String(item);
    } else {
      if (typeof item === 'string' && ['', 'null'].includes(item.trim())) { result[key] = null; continue; }
      if (!['string', 'number'].includes(typeof item) || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(String(item).trim()) || !new Decimal(String(item).trim()).isFinite()) throw new AppError('validation', messages.json);
      result[key] = javaDecimalText(item as string | number);
    }
  }
  return result;
}
function inspect(value: Record<string, unknown>, rules: Record<string, Rule>, prefix = ''): string[] {
  const errors: string[] = [];
  for (const [key, rule] of Object.entries(rules)) {
    const item = value[key]; const field = `${prefix}${({ posID: 'posId', employeID: 'employeId', campaign_id: 'campaignId', coupon_type: 'couponType', broadcast_channel: 'broadcastChannel' } as Record<string, string>)[key] ?? key}`;
    if (item === null || item === undefined) {
      if (!rule.nullable) errors.push(rule.blank ? `Lo sentimos, el atributo [${field}] es necesario para completar la solicitud.` : `El atributo [${field}] no puede ser nulo.`);
      continue;
    }
    if (rule.type === 'object') { errors.push(...inspect(item as Record<string, unknown>, rule.fields ?? {}, `${field}.`)); continue; }
    const string = String(item);
    if (rule.blank && string.trim().length === 0) errors.push(`Lo sentimos, el atributo [${field}] es necesario para completar la solicitud.`);
    if (rule.trimmed && string !== string.trim()) errors.push(`El atributo [${field}] no puede contener espacios en blanco`);
    if (rule.length && (string.length < 1 || string.length > rule.length)) errors.push(`El atributo [${field}] debe tener una longitud entre 1 y ${rule.length}`);
    if (rule.positive && !/^[+-]?\d+(?:\.\d+)?$/.test(string)) throw new AppError('validation', messages.json);
    if (rule.positive && new Decimal(string).lte(0)) errors.push(`El atributo [${field}] debe ser un número entero positivo`);
    if (rule.digits && !new RegExp(`^[+-]?\\d{1,${rule.digits}}$`).test(string)) errors.push(`El atributo [${field}] debe tener una longitud máxima de ${rule.digits}`);
    if (rule.type === 'amount') {
      // BigDecimal conserva la escala, incluso los ceros finales de 1.000.
      const match = /^[+-]?(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(string.trim());
      const scale = (match?.[2]?.length ?? 0) - Number(match?.[3] ?? 0);
      const precision = ((match?.[1] ?? '') + (match?.[2] ?? '')).replace(/^0+/, '').length || 1;
      if (!match || scale > 2 || precision - scale > 10) errors.push(`El atributo [${field}] debe ser numérico y máximo 2 decimales`);
    }
  }
  return errors;
}
export function body<T>(kind: 'validate' | 'redeem' | 'generate' | 'auth', raw: string | null, base64 = false): T {
  let value: unknown;
  try { value = parseJson(base64 ? Buffer.from(raw ?? '', 'base64').toString('utf8') : raw ?? ''); }
  catch { throw new AppError('validation', messages.json); }
  if (!object(value)) throw new AppError('validation', messages.json);
  let parsed: Record<string, unknown>;
  try {
    parsed = deserialize(value, schemas[kind]!);
    if (kind === 'validate') {
      for (const name of ['itemsOrder', 'comboOrder']) if (parsed[name] != null && !Array.isArray(parsed[name])) throw new AppError('validation', messages.json);
      parsed.itemsOrder = (parsed.itemsOrder as unknown[] | undefined | null)?.map(parseItem) ?? null;
      parsed.comboOrder = (parsed.comboOrder as unknown[] | undefined | null)?.map(parseCombo) ?? null;
    }
  }
  catch { throw new AppError('validation', messages.json); }
  const errors = inspect(parsed, schemas[kind]!);
  if (errors.length) throw new AppError('validation', errors.join(' | '));
  return parsed as T;
}
function parseCombo(value: unknown): Record<string, unknown> | null {
  if (value === null) return null;
  if (!object(value)) throw new AppError('validation', messages.json);
  const parsed = deserialize(value, { comboId: { type: 'integer' }, itemId: { type: 'integer' }, comboName: { type: 'string' }, familyId: { type: 'integer' }, quantity: { type: 'integer' }, amount: { type: 'amount' } });
  if (value.comboItems != null && !Array.isArray(value.comboItems)) throw new AppError('validation', messages.json);
  return { ...parsed, familyId: parsed.familyId ?? 0, comboItems: (value.comboItems as unknown[] | null | undefined)?.map(parseItem) ?? null };
}
function parseItem(value: unknown): Record<string, unknown> | null {
  if (value === null) return null;
  if (!object(value)) throw new AppError('validation', messages.json);
  const fields: Record<string, Rule> = {
    idItem: { type: 'integer', nullable: true }, typeItem: { type: 'integer', nullable: true }, nameItem: { type: 'string', nullable: true },
    familyId: { type: 'integer', nullable: true }, quantity: { type: 'integer', nullable: true }, amount: { type: 'amount', nullable: true },
    comment: { type: 'string', nullable: true }, priceLevel: { type: 'integer', nullable: true },
  };
  const deserialized = deserialize(value, fields);
  const result: Record<string, unknown> = Object.fromEntries(Object.keys(fields).map(key => [key, deserialized[key] ?? null]));
  for (const name of ['descart', 'multivalue']) {
    const raw = value[name];
    if (raw == null) result[name] = false;
    else if (typeof raw === 'boolean') result[name] = raw;
    else if (typeof raw === 'number' && Number.isInteger(raw)) result[name] = raw !== 0;
    else if (typeof raw === 'string' && ['', 'null', 'false', 'False', 'FALSE', 'true', 'True', 'TRUE'].includes(raw.trim())) result[name] = ['true', 'True', 'TRUE'].includes(raw.trim());
    else throw new AppError('validation', messages.json);
  }
  if (value.modifiers != null && !Array.isArray(value.modifiers)) throw new AppError('validation', messages.json);
  result.modifiers = (value.modifiers as unknown[] | null | undefined)?.map(parseModifier) ?? null;
  return result;
}
function parseModifier(value: unknown): Record<string, unknown> | null {
  if (value === null) return null;
  if (!object(value)) throw new AppError('validation', messages.json);
  const fields: Record<string, Rule> = { modifierId: { type: 'integer', nullable: true }, modifierName: { type: 'string', nullable: true },
    familyId: { type: 'integer', nullable: true }, quantity: { type: 'integer', nullable: true }, amount: { type: 'amount', nullable: true }, comment: { type: 'string', nullable: true } };
  const deserialized = deserialize(value, fields);
  if (value.modifiers != null && !Array.isArray(value.modifiers)) throw new AppError('validation', messages.json);
  return { ...Object.fromEntries(Object.keys(fields).map(key => [key, deserialized[key] ?? (key === 'familyId' ? 0 : null)])),
    modifiers: (value.modifiers as unknown[] | null | undefined)?.map(parseModifier) ?? null };
}
export const validateBody = (raw: string | null, encoded = false) => body<ValidateRequest>('validate', raw, encoded);
export const redeemBody = (raw: string | null, encoded = false) => body<RedeemRequest>('redeem', raw, encoded);
export const generateBody = (raw: string | null, encoded = false) => body<GenerateRequest>('generate', raw, encoded);
export function javaInteger(value: unknown): number {
  if (typeof value !== 'string' || !/^[+-]?\d+$/.test(value)) throw new AppError('technical', `For input string: "${String(value)}"`);
  const number = Number(value);
  if (!Number.isInteger(number) || number < -2147483648 || number > 2147483647) throw new AppError('technical', `For input string: "${value}"`);
  return number;
}
/** NumberUtils.parseNumber de Spring para @RequestParam Integer, distinto de parseInt del negocio. */
export function springInteger(value: string | undefined): number {
  if (value == null) return javaInteger(value);
  const text = value.replace(/[\u0009-\u000d\u001c-\u0020\u1680\u2000-\u2006\u2008-\u200a\u2028\u2029\u205f\u3000]/g, '');
  const hexadecimal = /^(-?)(?:0[xX]|#)([0-9a-fA-F]+)$/.exec(text);
  if (!hexadecimal) return javaInteger(text);
  const number = parseInt(hexadecimal[2]!, 16) * (hexadecimal[1] ? -1 : 1);
  if (!Number.isInteger(number) || number < -2147483648 || number > 2147483647) return javaInteger(text);
  return number;
}
