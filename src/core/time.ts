/** Orden temporal estable para DynamoDB, preservando hasta nanosegundos de SQL Timestamp. */
export function canonicalTimestamp(value: string | Date): string {
  const text = value instanceof Date ? value.toISOString() : value;
  const fraction = /\.(\d+)(?:Z|[+-]\d\d:\d\d)$/.exec(text)?.[1] ?? '';
  if (fraction.length > 9) throw new Error('Precisión temporal no compatible');
  const instant = new Date(text).toISOString();
  return `${instant.slice(0, 19)}.${fraction.padEnd(9, '0')}Z`;
}
