import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { loadConfig } from '../src/core/config.js';
import { createApplication } from '../src/http/application.js';
import { Authentication } from '../src/domain/auth.js';
import { Coupons } from '../src/domain/coupons.js';
import { MemoryTransactions } from '../src/infrastructure/memory.js';
import type { CouponProvider, SecretReader } from '../src/core/types.js';
import { DigitalCoupons } from '../src/infrastructure/providers.js';
import { transport } from '../src/infrastructure/http.js';

if (!process.env.LOCAL_CLIENT_ID || !process.env.LOCAL_CLIENT_SECRET) throw new Error('Configurar LOCAL_CLIENT_ID y LOCAL_CLIENT_SECRET para el servidor local');
const config = { ...loadConfig(), authSecret: 'local-auth', signingSecret: 'local-signing', generateMock: true };
const signingKey = randomBytes(48).toString('base64');
const secrets: SecretReader = { async get<T extends Record<string, unknown>>(id: string) {
  if (id === 'local-signing') return { keyBase64: signingKey } as unknown as T;
  if (id === 'local-auth') return { clientId: process.env.LOCAL_CLIENT_ID, clientSecret: process.env.LOCAL_CLIENT_SECRET } as unknown as T;
  throw new Error('El servidor local solo utiliza integraciones simuladas');
} };
const generate = new DigitalCoupons(config, secrets, transport(5000));
const provider: CouponProvider = {
  async validate(request, uid) { return { fcUID: uid, fcTokenRedencion: 'LOCAL_SIMULATION', cupon: { fcFolioCuponID: request.couponCode, fiTipoPromocionID: 1, fcValorCupon: '20' }, restricciones: [], fcCampoAdicion2: '{}' }; },
  async redeem(request) { return { folioCuponId: request.couponCode }; },
  async generate(request) { return generate.generate(request); },
};
const application = createApplication(new Authentication(config, secrets), new Coupons(new MemoryTransactions(), provider));
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const chunks: Buffer[] = []; let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 6 * 1024 * 1024) { response.writeHead(413).end(); return; }
      chunks.push(Buffer.from(chunk));
    }
    const result = await application({ httpMethod: request.method ?? 'GET', path: url.pathname,
      headers: Object.fromEntries(Object.entries(request.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(',') : value])),
      queryStringParameters: Object.fromEntries(url.searchParams), body: chunks.length ? Buffer.concat(chunks).toString('utf8') : null });
    response.writeHead(result.statusCode, result.headers).end(result.isBase64Encoded ? Buffer.from(result.body, 'base64') : result.body);
  } catch { response.writeHead(500).end(); }
});
server.requestTimeout = 29_000;
server.listen(Number(process.env.PORT ?? 8080), '127.0.0.1', () => {
  const address = server.address();
  console.info(`Servidor local en http://127.0.0.1:${address && typeof address === 'object' ? address.port : 8080}; datos en memoria y proveedores simulados.`);
});
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => server.close(() => process.exit(0)));
