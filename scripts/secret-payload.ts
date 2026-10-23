import { jwtSigningKey, securityField, securityFields } from '../src/core/security-fields.js';

/** Valida el JSON completo antes de crear un cliente AWS; nunca incluye valores en errores. */
export function validateSecretPayload(input: unknown): asserts input is Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Estructura de secreto inválida');
  const value = input as Record<string, unknown>;
  for (const field of securityFields) securityField(value, field);
  jwtSigningKey(value);
  if (Object.values(value).some(field => typeof field === 'string' && /REPLACE_ME/i.test(field))) throw new Error('Sustituir los marcadores antes de cargar el secreto');
}
