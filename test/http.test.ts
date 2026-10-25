import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeJwt, decodeProtectedHeader } from 'jose';
import { Authentication } from '../src/domain/auth.js';
import { Coupons } from '../src/domain/coupons.js';
import { MemoryTransactions } from '../src/infrastructure/memory.js';
import { createApplication, type HttpEvent } from '../src/http/application.js';
import { body, javaInteger, springInteger, validateBody } from '../src/core/validation.js';
import { javaDecimalText, parseJson, stringify } from '../src/core/json.js';
import { Decimal } from 'decimal.js';
import { persistence, publicError, technical } from '../src/core/errors.js';
import { testJwtSecret, config, secrets, request, coupon, redeem, generate } from './fixtures.js';

function setup() {
  const repository = new MemoryTransactions();
  const provider = { async validate() { return coupon(); }, async redeem() { return { folioCuponId: 'TEST001' }; }, async generate() { return { coupon: { code: 'TEST002' } }; } };
  const auth = new Authentication(config(), secrets);
  const application = createApplication(auth, new Coupons(repository, provider));
  return { repository, provider, auth, application };
}
function event(path: string, method = 'GET', value?: unknown, token?: string): HttpEvent {
  return { httpMethod: method, path, body: value === undefined ? null : JSON.stringify(value), headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(value === undefined ? {} : { 'Content-Type': 'application/json' }) } };
}
test('JWT HS384 conserva iat=exp y expiresIn como epoch en texto', async () => {
  const now = 1_700_000_000_000; const auth = new Authentication(config(), secrets, () => now);
  const token = await auth.issue('test-client', testJwtSecret); assert.ok(token);
  assert.equal(decodeProtectedHeader(token.accessToken).alg, 'HS384');
  const claims = decodeJwt(token.accessToken); assert.equal(claims.iat, claims.exp); assert.equal(token.expiresIn, String(claims.exp));
  assert.equal(await auth.valid(`bEaReR ${token.accessToken}`), true);
  const expired = new Authentication(config(), secrets, () => now + 86_400_000);
  assert.equal(await expired.valid(`Bearer ${token.accessToken}`), false);
});
test('credenciales incorrectas y JWT inválidos devuelven 401 vacío', async () => {
  const { application } = setup();
  const login = await application(event('/auth/token', 'POST', { clientId: 'test-client', clientSecret: 'incorrect' }));
  assert.equal(login.statusCode, 401); assert.equal(login.body, '');
  const denied = await application(event('/coupons/validate', 'POST', request(), 'invalid'));
  assert.equal(denied.statusCode, 401); assert.equal(denied.body, '');
});
test('healthcheck es público, literal y no añade correlación', async () => {
  const response = await setup().application(event('/coupons/healthcheck'));
  assert.equal(response.body, 'HealthCheck MS Admin Cupon OK'); assert.equal(response.headers['Content-Type'], 'application/json');
  assert.equal(response.headers['X-Transaction-ID'], undefined);
  assert.equal(response.headers['X-Content-Type-Options'], 'nosniff'); assert.equal(response.headers['X-Frame-Options'], 'DENY');
  assert.equal(response.headers['Cache-Control'], 'no-cache, no-store, max-age=0, must-revalidate');
});
test('contratos de validate, latest, redeem y generate completos', async () => {
  const { application, auth } = setup(); const token = (await auth.issue('test-client', testJwtSecret))!.accessToken;
  const validated = await application(event('/coupons/validate', 'POST', request(), token));
  const result = JSON.parse(validated.body);
  assert.equal(validated.statusCode, 200); assert.equal(result.data.totalDiscount, 20); assert.equal(result.data.discountId, '7002');
  assert.deepEqual(Object.keys(result), ['uid', 'timestamp', 'status', 'type', 'message', 'helpUrl', 'success', 'data']);
  assert.match(result.timestamp, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{4}$/);
  const latestEvent = { ...event('/coupons/transaction/latest', 'GET', undefined, token), queryStringParameters: { countryId: '1', brandId: '11', storeId: '1', couponCode: 'TEST001' } };
  assert.deepEqual(JSON.parse((await application(latestEvent)).body).data, { uid: 'test-uid', redeemed: false });
  const redeemed = await application(event('/coupons/redeem', 'POST', redeem(), token));
  assert.equal(redeemed.statusCode, 200); assert.equal(JSON.parse(redeemed.body).status, 201); assert.equal(JSON.parse(redeemed.body).data.code, '000');
  assert.equal(JSON.parse((await application(latestEvent)).body).uid, null);
  assert.deepEqual(JSON.parse((await application(event('/coupons/generate', 'POST', generate(), token))).body).data, { coupon: { code: 'TEST002' } });
});
test('JSON malformado, campos ausentes, nulos y espacios usan el contrato de errores', async () => {
  const { application, auth } = setup(); const token = (await auth.issue('test-client', testJwtSecret))!.accessToken;
  const invalid = event('/coupons/validate', 'POST', request(), token); invalid.body = '{';
  const response = await application(invalid); assert.equal(response.statusCode, 400); assert.equal(JSON.parse(response.body).success, false);
  const spaced = { ...request(), couponCode: ' X ' };
  assert.throws(() => validateBody(JSON.stringify(spaced)), /espacios en blanco/);
  assert.throws(() => validateBody(JSON.stringify({ ...request(), brandId: null })), /brandId.*nulo/);
  assert.throws(() => body('generate', JSON.stringify({ request: { ...generate().request, coupon_type: -1 }, customer: generate().customer })), /request.couponType/);
});
test('error de persistencia devuelve HTTP 500 y mensaje genérico', async () => {
  const { repository, application, auth } = setup(); repository.save = async () => { throw persistence(new Error('SensitiveDatabaseMessage')); };
  const token = (await auth.issue('test-client', testJwtSecret))!.accessToken;
  const response = await application(event('/coupons/validate', 'POST', request(), token));
  assert.equal(response.statusCode, 500); assert.ok(!response.body.includes('SensitiveDatabaseMessage'));
});
test('subida de tienda BigBan requiere autenticación y guarda idempotentemente', async () => {
  const { application, auth } = setup(); const token = (await auth.issue('test-client', testJwtSecret))!.accessToken;
  const storePayload = { countryId: 1, brandId: 11, storeId: 101, name: 'Tienda Test BigBan', posList: [1, 2] };
  const unauth = await application(event('/coupons/pos/store', 'POST', storePayload));
  assert.equal(unauth.statusCode, 401);
  const response = await application(event('/coupons/pos/store', 'POST', storePayload, token));
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.success, true);
  assert.equal(body.message, 'Tienda guardada exitosamente.');
  assert.equal(body.data.storeKey, 'stores/country_1/brand_11/store_101.json');
});
test('rutas técnicas, documentación, métodos inválidos y ausencia de Actuator', async () => {
  const { application, auth } = setup(); const token = (await auth.issue('test-client', testJwtSecret))!.accessToken;
  assert.equal((await application(event('/swagger-ui.html'))).statusCode, 302);
  const openapi = JSON.parse((await application(event('/v3/api-docs'))).body);
  assert.equal(openapi.info.version, '1.0.5'); assert.ok(openapi.paths['/coupons/generate']); assert.ok(openapi.paths['/coupons/pos/store']);
  assert.equal((await application(event('/swagger-ui/index.html'))).statusCode, 200);
  assert.equal((await application(event('/test-insights', 'GET', undefined, token))).body, 'Evento de prueba enviado a Application Insights');
  assert.equal((await application(event('/coupons/generate', 'GET', undefined, token))).statusCode, 405);
  assert.equal((await application(event('/actuator/health', 'GET', undefined, token))).statusCode, 404);
  assert.equal((await application(event('/does-not-exist', 'GET', undefined, token))).statusCode, 404);
});
test('la correlación no permite inyectar líneas y las cabeceras no dependen de mayúsculas', async () => {
  const { application, auth } = setup(); const token = (await auth.issue('test-client', testJwtSecret))!.accessToken;
  const input = event('/coupons/generate', 'POST', generate(), token); input.headers['x-transaction-id'] = 'abc\r\nforged';
  const response = await application(input); assert.equal(response.headers['X-Transaction-ID'], 'abcforged');
});
test('negociación de contenido, parámetros y HEAD conservan seguridad y Problem Details', async () => {
  const { application, auth } = setup(); const token = (await auth.issue('test-client', testJwtSecret))!.accessToken;
  const input = event('/coupons/validate', 'POST', request(), token); input.headers['Content-Type'] = 'text/plain';
  const unsupported = await application(input);
  assert.equal(unsupported.statusCode, 415); assert.equal(unsupported.headers['Content-Type'], 'application/problem+json');
  const missing = await application(event('/coupons/transaction/latest', 'GET', undefined, token));
  assert.equal(missing.statusCode, 400); assert.equal(JSON.parse(missing.body).type, 'about:blank');
  assert.equal((await application(event('/coupons/healthcheck', 'HEAD'))).statusCode, 401);
  assert.equal((await application(event('/v3/api-docs.yaml'))).statusCode, 401);
  const yaml = await application(event('/v3/api-docs.yaml', 'GET', undefined, token));
  assert.equal(yaml.statusCode, 200); assert.match(yaml.body, /openapi:/);
});
test('JSON conserva precisión monetaria sin convertir números de salida en cadenas', () => {
  const parsed = parseJson('{"amount":12345678901234567890.123456789,"idItem":1}') as { amount: string };
  assert.equal(parsed.amount, '12345678901234567890.123456789');
  assert.equal(stringify({ amount: new Decimal(parsed.amount) }), '{"amount":12345678901234567890.123456789}');
});
test('BigDecimal conserva escala, normalización y exponentes sin expansión masiva', () => {
  for (const [raw, expected] of [[' +001.2300 ', '1.2300'], ['1e-7', '1E-7'], ['-0.00', '0.00'], ['1e100000000', '1E+100000000'], ['.50', '0.50']]) {
    assert.equal(javaDecimalText(raw!), expected);
  }
  assert.throws(() => javaDecimalText('0x10'));
  assert.throws(() => javaDecimalText('1e2147483648'));
});
test('Digits conserva la escala del lexema de entrada, incluidos ceros finales', () => {
  const raw = JSON.stringify(request()).replace('"totalOrder":"100"', '"totalOrder":1.000');
  assert.throws(() => validateBody(raw), /máximo 2 decimales/);
});
test('DTO anidado inválido falla en deserialización antes de invocar proveedores', () => {
  const input = request();
  for (const nested of [{ comboOrder: [{ comboId: {} }] }, { comboOrder: [{ comboItems: [false] }] }, { itemsOrder: [{ amount: 'no-es-decimal' }] }]) {
    assert.throws(() => validateBody(JSON.stringify({ ...input, ...nested })), /El JSON de la solicitud es incorrecto/);
  }
  assert.throws(() => body('generate', JSON.stringify({ ...generate(), customer: { ...generate().customer, phone: {} } })), /El JSON/);
  assert.throws(() => body('redeem', JSON.stringify({ ...redeem(), nombreColaborador: [] })), /El JSON/);
});
test('prefijos similares a la lista pública de documentación conservan autenticación', async () => {
  const { application } = setup();
  assert.equal((await application(event('/v2/api-docs-private'))).statusCode, 401);
  assert.equal((await application(event('/swagger-resources-private'))).statusCode, 401);
});
test('mensaje técnico vacío se conserva; detalles conocidos del proveedor se saneaban ya en Java', () => {
  assert.equal(publicError(technical('')).message, '');
  assert.equal(publicError(technical('I/O error on GET https://provider.invalid')).message, 'No fue posible completar la solicitud con el servicio de cuponera. ');
});
test('coerción Jackson distingue enteros nulos y booleanos primitivos', () => {
  const input = request();
  assert.throws(() => validateBody(JSON.stringify({ ...input, countryId: '' })), /countryId.*no puede ser nulo/);
  const parsed = validateBody(JSON.stringify({ ...input, itemsOrder: [{ ...input.itemsOrder![0], descart: 0, multivalue: ' TRUE ' }] }));
  assert.equal(parsed.itemsOrder![0]!.descart, false); assert.equal(parsed.itemsOrder![0]!.multivalue, true);
});
test('RequestParam Integer usa conversión Spring; ticketId conserva Integer.parseInt estricto', () => {
  assert.equal(springInteger(' 1 0 '), 10); assert.equal(springInteger('0x10'), 16); assert.equal(springInteger('#10'), 16);
  assert.equal(springInteger('-0x80000000'), -2147483648); assert.equal(springInteger('010'), 10);
  assert.throws(() => springInteger('0x80000000')); assert.throws(() => springInteger('+0x10'));
  assert.throws(() => javaInteger(' 1 ')); assert.throws(() => javaInteger('0x10'));
});
test('Swagger mantiene el stage en redirects y recursos al usar la URL execute-api', async () => {
  const { application } = setup();
  const context = { domainName: 'local-test.execute-api.us-east-1.amazonaws.com', stage: 'qa' };
  const redirected = await application({ ...event('/swagger-ui.html'), requestContext: context });
  assert.equal(redirected.headers.Location, '/qa/swagger-ui/index.html');
  const config = JSON.parse((await application({ ...event('/v3/api-docs/swagger-config'), requestContext: context })).body);
  assert.equal(config.url, '/qa/v3/api-docs'); assert.equal(config.oauth2RedirectUrl, '/qa/swagger-ui/oauth2-redirect.html');
});
