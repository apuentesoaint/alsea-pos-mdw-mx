/** Campos del JSON único administrado por DevOps; los errores nunca incluyen valores. */
export const securityFields = ['cuponera_mx_credential', 'jwt_clientId', 'jwt_clientSecret', 'sbx_client', 'sbx_secret'] as const;
export type SecurityField = typeof securityFields[number];
export function securityField(secret: Record<string, unknown>, field: SecurityField): string {
  const value = secret[field];
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || /REPLACE_ME/i.test(value) || ['APISBX_CLIENT', 'APISBX_SECRET'].includes(value)) throw new Error(`Configuración segura incompleta: ${field}`);
  if (field === 'cuponera_mx_credential' && /^\s*Basic\s/i.test(value)) throw new Error('La credencial Cuponera debe omitir el prefijo Basic');
  if (['cuponera_mx_credential', 'sbx_client', 'sbx_secret'].includes(field)) {
    try {
      // Headers verifica ByteString, controles y normalización del transporte real.
      if (new Headers({ credential: value }).get('credential') !== value) throw new Error();
    } catch { throw new Error(`Credencial no válida para cabecera HTTP: ${field}`); }
  }
  return value;
}

/** HS384 usa los bytes UTF-8 de jwt_clientSecret; no interpretar Base64 ni hexadecimal. */
export function jwtSigningKey(secret: Record<string, unknown>): Buffer {
  const key = Buffer.from(securityField(secret, 'jwt_clientSecret'), 'utf8');
  if (key.byteLength < 48) throw new Error('jwt_clientSecret requiere al menos 48 bytes UTF-8 para HS384');
  return key;
}
