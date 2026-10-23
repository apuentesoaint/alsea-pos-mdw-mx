import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jwtVerify, SignJWT } from 'jose';
import { Authentication } from '../src/domain/auth.js';
import { DigitalCoupons } from '../src/infrastructure/providers.js';
import { CachedSecrets } from '../src/infrastructure/secrets.js';
import { jwtSigningKey } from '../src/core/security-fields.js';
import { requestContext } from '../src/core/logging.js';
import { createApplication } from '../src/http/application.js';
import { loadConfig } from '../src/core/config.js';
import { config, coupon, request, securityPayload, testJwtSecret } from './fixtures.js';

test('autenticación y ambos proveedores comparten una sola lectura SDK del secreto único', async () => {
  let reads = 0;
  const cache = new CachedSecrets({ send: async (command: { input: { SecretId: string } }) => {
    assert.equal(command.input.SecretId, config().securitySecret);
    reads++; return { SecretString: JSON.stringify(securityPayload()) };
  } } as never);
  const auth = new Authentication(config(), cache);
  const token = await auth.issue('test-client', testJwtSecret);
  assert.ok(token); assert.equal(await auth.valid(`Bearer ${token.accessToken}`), true);
  const provider = new DigitalCoupons(config(), cache, async (url, init) => {
    if (url.startsWith('https://provider.invalid/token')) {
      assert.equal(new Headers(init.headers).get('Authorization'), 'Basic TEST_ONLY');
      return { status: 200, text: '{"access_token":"TEST_ONLY","expires_in":3600}' };
    }
    if (url === 'https://starbucks.invalid/v1/token') {
      assert.equal(new Headers(init.headers).get('x-api-key'), 'test-client');
      assert.equal(new Headers(init.headers).get('client-secret'), 'test-secret');
      return { status: 200, text: '{"access_token":"TEST_ONLY","expires_in":3600}' };
    }
    return { status: 200, text: url.includes('starbucks') ? '{"FolioCupon1":"CONVERTED"}' : JSON.stringify(coupon()) };
  });
  const input = request(); input.brandId = 10;
  await provider.validate(input, 'test-uid');
  assert.equal(reads, 1);
});

test('la firma usa jwt_clientSecret UTF-8 y deja de aceptar la clave independiente anterior', async () => {
  const value = { ...securityPayload(), jwt_clientSecret: 'a1'.repeat(32) };
  const reader = { async get<T extends Record<string, unknown>>(): Promise<T> { return value as unknown as T; } };
  const auth = new Authentication(config(), reader);
  const token = await auth.issue(value.jwt_clientId, value.jwt_clientSecret);
  assert.ok(token);
  await jwtVerify(token.accessToken, Buffer.from(value.jwt_clientSecret, 'utf8'), { algorithms: ['HS384'] });
  await assert.rejects(jwtVerify(token.accessToken, Buffer.from(value.jwt_clientSecret, 'base64')));
  await assert.rejects(jwtVerify(token.accessToken, Buffer.from(value.jwt_clientSecret, 'hex')));
  const previous = await new SignJWT({ sub: 'test-client' }).setProtectedHeader({ alg: 'HS384' }).setExpirationTime('1h').sign(Buffer.alloc(48, 7));
  assert.equal(await auth.valid(`Bearer ${previous}`), false);
  value.jwt_clientSecret = 'b2'.repeat(32);
  assert.equal(await auth.valid(`Bearer ${token.accessToken}`), false);
  assert.equal(await auth.issue(value.jwt_clientId, 'a1'.repeat(32)), undefined);
  const rotated = await auth.issue(value.jwt_clientId, value.jwt_clientSecret);
  assert.ok(rotated); assert.equal(await auth.valid(`Bearer ${rotated.accessToken}`), true);
});

test('HS384 rechaza una credencial corta sin registrar su valor', () => {
  assert.throws(() => jwtSigningKey({ jwt_clientSecret: 'SENSITIVE_TEST_ONLY' }), error => error instanceof Error && !error.message.includes('SENSITIVE_TEST_ONLY'));
});

test('configuración solo acepta el identificador único e ignora variables antiguas', () => {
  const names = ['SECURITY_SECRET_ID', 'AUTH_SECRET_ARN', 'SIGNING_SECRET_ARN', 'CUPONERA_SECRET_ARN', 'STARBUCKS_SECRET_ARN'];
  const previous = names.map(name => process.env[name]);
  try {
    for (const name of names) process.env[name] = 'OBSOLETE_TEST_ONLY';
    process.env.SECURITY_SECRET_ID = 'cuponera-api-security/dev/aws-mdw';
    assert.equal(loadConfig().securitySecret, 'cuponera-api-security/dev/aws-mdw');
    delete process.env.SECURITY_SECRET_ID;
    assert.equal(loadConfig().securitySecret, '');
  } finally {
    names.forEach((name, index) => { if (previous[index] === undefined) delete process.env[name]; else process.env[name] = previous[index]; });
  }
});

test('HS384 mide bytes UTF-8 sin normalizar las credenciales', () => {
  for (const value of ['a'.repeat(47), ' ' + testJwtSecret, testJwtSecret + ' ']) assert.throws(() => jwtSigningKey({ jwt_clientSecret: value }));
  assert.equal(jwtSigningKey({ jwt_clientSecret: 'a'.repeat(48) }).length, 48);
  assert.equal(jwtSigningKey({ jwt_clientSecret: 'á'.repeat(24) }).length, 48);
});

test('la caché renueva una vez al vencer y no devuelve versiones caducadas ante un fallo', async t => {
  let now = 0; let reads = 0; let failure = false; let version = 'v1';
  t.mock.method(Date, 'now', () => now);
  const cache = new CachedSecrets({ send: async () => {
    reads++;
    if (failure) throw new Error('SENSITIVE_TEST_ONLY');
    return { SecretString: JSON.stringify({ version }) };
  } } as never, 100);
  assert.equal((await cache.get('test/security')).version, 'v1');
  now = 99; version = 'v2';
  assert.equal((await cache.get('test/security')).version, 'v1');
  now = 100;
  const refreshed = await Promise.all([cache.get('test/security'), cache.get('test/security')]);
  assert.ok(refreshed.every(value => value.version === 'v2')); assert.equal(reads, 2);
  now = 200; failure = true;
  const failures = await Promise.allSettled([cache.get('test/security'), cache.get('test/security')]);
  assert.ok(failures.every(value => value.status === 'rejected')); assert.equal(reads, 3);
  failure = false; version = 'v3';
  assert.equal((await cache.get('test/security')).version, 'v3'); assert.equal(reads, 4);
});

test('el lector recupera un secreto binario y vuelve a intentar tras formatos inválidos', async () => {
  const responses = [{}, { SecretString: 'SENSITIVE_TEST_ONLY_INVALID_JSON' }, { SecretString: 'null' }, { SecretString: '[]' }, { SecretString: '1' }, { SecretBinary: Buffer.from('{"version":"TEST_ONLY"}') }];
  let reads = 0;
  const cache = new CachedSecrets({ send: async () => responses[reads++] } as never);
  await assert.rejects(cache.get('')); assert.equal(reads, 0);
  for (let index = 0; index < responses.length - 1; index++) await assert.rejects(cache.get('test/security'), /No fue posible cargar la configuración segura/);
  assert.equal((await cache.get('test/security')).version, 'TEST_ONLY'); assert.equal(reads, responses.length);
});

test('el lector respeta el plazo Lambda y permite recuperarse en otra solicitud', async () => {
  let reads = 0;
  const cache = new CachedSecrets({ send: async (_command: unknown, options: { abortSignal: AbortSignal }) => {
    reads++; assert.ok(options.abortSignal instanceof AbortSignal);
    options.abortSignal.throwIfAborted();
    return { SecretString: JSON.stringify(securityPayload()) };
  } } as never);
  const context = { transactionId: 'test', requestId: 'test', route: 'POST /auth/token', deadline: Date.now() - 1 };
  await assert.rejects(requestContext.run(context, () => cache.get('test/security')), /No fue posible cargar/);
  assert.equal((await cache.get('test/security')).jwt_clientId, 'test-client'); assert.equal(reads, 2);
});

test('fallos SDK y JSON secreto inválido no publican valores en HTTP ni registros', async t => {
  const output: string[] = [];
  for (const method of ['info', 'warn', 'error'] as const) t.mock.method(console, method, (...values: unknown[]) => { output.push(values.map(String).join(' ')); });
  for (const invalidJson of [false, true]) {
    const cache = new CachedSecrets({ send: async () => {
      if (invalidJson) return { SecretString: '{"SENSITIVE_TEST_ONLY":' };
      throw new Error('SENSITIVE_TEST_ONLY');
    } } as never);
    const application = createApplication(new Authentication(config(), cache), {} as never);
    const response = await application({ httpMethod: 'POST', path: '/auth/token', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: 'test-client', clientSecret: testJwtSecret }) });
    assert.equal(response.statusCode, 500); assert.ok(!response.body.includes('SENSITIVE_TEST_ONLY'));
  }
  assert.ok(output.length > 0); assert.ok(!output.join('\n').includes('SENSITIVE_TEST_ONLY'));
});
