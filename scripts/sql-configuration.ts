/** Configuración privada del operador SQL; no pertenece al secreto de la API. */
export function validateSqlConfiguration(input: unknown): asserts input is Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Configuración SQL inválida');
  const value = input as Record<string, unknown>;
  if (['host', 'username', 'password', 'dbname'].some(field => typeof value[field] !== 'string' || !String(value[field]).trim())) throw new Error('Configuración SQL incompleta');
  if (Object.values(value).some(field => typeof field === 'string' && /REPLACE_ME/i.test(field))) throw new Error('Sustituir los marcadores de configuración SQL');
  if (value.port !== undefined) {
    const port = typeof value.port === 'number' || typeof value.port === 'string' ? Number(value.port) : NaN;
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Puerto SQL inválido');
  }
}
