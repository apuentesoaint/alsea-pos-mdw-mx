import { createHash, timingSafeEqual } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import type { Config } from '../core/config.js';
import type { SecretReader } from '../core/types.js';
import { jwtSigningKey, securityField } from '../core/security-fields.js';
import { metric } from '../core/logging.js';

function equal(left: string, right: string): boolean {
  return timingSafeEqual(createHash('sha256').update(left).digest(), createHash('sha256').update(right).digest());
}
export class Authentication {
  constructor(private readonly config: Config, private readonly secrets: SecretReader, private readonly now = () => Date.now()) {}
  async issue(clientId: string, clientSecret: string): Promise<{ tokenType: string; accessToken: string; expiresIn: string } | undefined> {
    const credentials = await this.secrets.get(this.config.securitySecret);
    if (!(equal(securityField(credentials, 'jwt_clientId'), clientId) && equal(securityField(credentials, 'jwt_clientSecret'), clientSecret))) {
      metric('AuthenticationFailures'); return undefined;
    }
    const key = jwtSigningKey(credentials);
    const expiration = Math.floor(this.now() / 1000) + this.config.jwtTtlSeconds;
    // Paridad con JwtTokenProvider: iat recibe expiryDate, no la fecha actual.
    const accessToken = await new SignJWT({ sub: clientId, iat: expiration, exp: expiration })
      .setProtectedHeader({ alg: 'HS384' }).sign(key);
    return { tokenType: 'bearer', accessToken, expiresIn: String(expiration) };
  }
  async valid(header: string | undefined): Promise<boolean> {
    if (!header?.toLowerCase().startsWith('bearer ')) return false;
    const signing = await this.secrets.get(this.config.securitySecret);
    try {
      const key = jwtSigningKey(signing);
      const result = await jwtVerify(header.substring(7), key, { algorithms: ['HS256', 'HS384'], currentDate: new Date(this.now()) });
      return typeof result.payload.sub === 'string' && result.payload.sub.length > 0;
    } catch { metric('AuthenticationFailures'); return false; }
  }
}
