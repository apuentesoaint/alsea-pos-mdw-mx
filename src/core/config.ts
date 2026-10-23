export interface Config {
  stage: string; table: string; bucket: string; securitySecret: string; secretCacheMs: number;
  tokenUrl: string; validateUrl: string; redeemUrl: string; generateUrl: string;
  starbucksUrl: string; starbucksVersion: string; starbucksTokenPath: string; starbucksCouponPath: string;
  httpTimeoutMs: number; jwtTtlSeconds: number; generateMock: boolean;
  campaign: string; promotionOne: string; promotionTwo: string;
}
function integer(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`Configuración inválida: ${name}`);
  return value;
}
export function loadConfig(): Readonly<Config> {
  return Object.freeze({
    stage: process.env.STAGE ?? 'dev', table: process.env.TRANSACTIONS_TABLE ?? '', bucket: process.env.DETAILS_BUCKET ?? '',
    securitySecret: process.env.SECURITY_SECRET_ID ?? '',
    secretCacheMs: integer('SECRET_CACHE_SECONDS', 300) * 1000,
    tokenUrl: process.env.CUPONERA_URI_TOKEN ?? '', validateUrl: process.env.CUPONERA_URI_VALIDATE_V1 ?? '',
    redeemUrl: process.env.CUPONERA_URI_REDEEM_V1 ?? '', generateUrl: process.env.CUPONERA_URI_GENERATE ?? '',
    starbucksUrl: process.env.APISBX_URI ?? '', starbucksVersion: process.env.APISBX_VERSION ?? '',
    starbucksTokenPath: process.env.APISBX_PATH_TOKEN ?? '', starbucksCouponPath: process.env.APISBX_PATH_SERVICE_COUPONS ?? '',
    httpTimeoutMs: integer('HTTP_TIMEOUT_MS', 5000), jwtTtlSeconds: integer('JWT_TTL_SECONDS', 86400),
    generateMock: process.env.GENERATE_MOCK === 'true', campaign: process.env.GENERATE_CAMPAIGN ?? 'FMR',
    promotionOne: process.env.GENERATE_PROMOTION_ONE ?? 'OZ', promotionTwo: process.env.GENERATE_PROMOTION_TWO ?? 'S8',
  });
}
