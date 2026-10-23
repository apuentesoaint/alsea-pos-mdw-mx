import { Decimal } from 'decimal.js';

declare global { interface JSON { rawJSON(text: string): unknown } }
const scales = new WeakMap<Decimal, number>();
export function scaled(value: Decimal, scale: number): Decimal { scales.set(value, scale); return value; }

/** BigDecimal.toString: conserva escala y notación científica sin expandir exponentes enormes. */
export function javaDecimalText(value: string | number): string {
  const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/.exec(String(value).trim());
  if (!match) throw new SyntaxError('Decimal inválido');
  const fraction = match[3] ?? match[4] ?? '';
  const exponent = Number(match[5] ?? 0);
  const scale = fraction.length - exponent;
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 2147483647 || Math.abs(scale) > 2147483647) throw new SyntaxError('Escala decimal inválida');
  const digits = ((match[2] ?? '') + fraction).replace(/^0+/, '') || '0';
  const sign = match[1] === '-' && digits !== '0' ? '-' : '';
  const adjusted = digits.length - scale - 1;
  if (scale >= 0 && adjusted >= -6) {
    const padded = digits.padStart(scale + 1, '0');
    return sign + (scale === 0 ? padded : `${padded.slice(0, -scale)}.${padded.slice(-scale)}`);
  }
  const coefficient = digits.length === 1 ? digits : `${digits[0]}.${digits.slice(1)}`;
  return `${sign}${coefficient}E${adjusted >= 0 ? '+' : ''}${adjusted}`;
}

const monetary = new Set(['amount', 'totalOrder', 'totalOrderWithOutDiscount', 'totalDiscountOrder', 'fnMontoDisponible']);
/** Conserva el lexema decimal del JSON antes de que IEEE-754 pierda precisión. */
export function parseJson(text: string): unknown {
  return JSON.parse(text, (key: string, value: unknown, context?: { source?: string }) => typeof value === 'number' && monetary.has(key) ? context?.source ?? String(value) : value);
}
export function stringify(value: unknown): string {
  return JSON.stringify(value, function (key, current) {
    const original = key === '' ? value : this[key];
    if (Decimal.isDecimal(original)) return JSON.rawJSON(scales.has(original) ? original.toFixed(scales.get(original)!) : original.toFixed());
    return current;
  });
}
