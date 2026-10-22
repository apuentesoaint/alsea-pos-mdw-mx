import { createHash, timingSafeEqual } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import type { Config } from '../core/config.js';
import type { SecretReader } from '../core/types.js';
import { metric } from '../core/logging.js';

function equal(left: string, right: string): boolean {
  return timingSafeEqual(createHash('sha256').update(left).digest(), createHash('sha256').update(right).digest());
}
function stringField(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('Configuración segura incompleta');
  return value;
}
export class Authentication {
  constructor(private readonly config: Config, private readonly secrets: SecretReader, private readonly now = () => Date.now()) {}
  async issue(clientId: string, clientSecret: string): Promise<{ tokenType: string; accessToken: string; expiresIn: string } | undefined> {
    const credentials = await this.secrets.get(this.config.authSecret);
    if (!(equal(stringField(credentials.clientId), clientId) && equal(stringField(credentials.clientSecret), clientSecret))) {
      metric('AuthenticationFailures'); return undefined;
    }
    const signing = await this.secrets.get(this.config.signingSecret);
    const key = Buffer.from(stringField(signing.keyBase64), 'base64');
    if (key.byteLength < 48) throw new Error('La clave JWT HS384 debe contener al menos 48 bytes');
    const expiration = Math.floor(this.now() / 1000) + this.config.jwtTtlSeconds;
    // Paridad con JwtTokenProvider: iat recibe expiryDate, no la fecha actual.
    const accessToken = await new SignJWT({ sub: clientId, iat: expiration, exp: expiration })
      .setProtectedHeader({ alg: 'HS384' }).sign(key);
    return { tokenType: 'bearer', accessToken, expiresIn: String(expiration) };
  }
  async valid(header: string | undefined): Promise<boolean> {
    if (!header?.toLowerCase().startsWith('bearer ')) return false;
    const signing = await this.secrets.get(this.config.signingSecret);
    try {
      const key = Buffer.from(stringField(signing.keyBase64), 'base64');
      const result = await jwtVerify(header.substring(7), key, { algorithms: ['HS256', 'HS384'], currentDate: new Date(this.now()) });
      return typeof result.payload.sub === 'string' && result.payload.sub.length > 0;
    } catch { metric('AuthenticationFailures'); return false; }
  }
}
