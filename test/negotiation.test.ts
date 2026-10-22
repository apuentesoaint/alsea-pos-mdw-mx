import { test } from 'node:test';
import assert from 'node:assert/strict';
import { negotiate, parseAccept, requestHeaders, jsonTypes } from '../src/http/negotiation.js';
import { HttpProblem } from '../src/http/problems.js';
import { createApplication, type HttpEvent } from '../src/http/application.js';
import { Authentication } from '../src/domain/auth.js';
import { Coupons } from '../src/domain/coupons.js';
import { MemoryTransactions } from '../src/infrastructure/memory.js';
import { LegacyRuntimeError, legacyRuntime, legacyRuntimeMessages } from '../src/core/legacy-errors.js';
import { publicError } from '../src/core/errors.js';
import { config, secrets, coupon, request, redeem, generate } from './fixtures.js';

// Expectativas derivadas del código Spring 6.1.3, no capturadas de una JVM.
for (const [accept, expected] of [
  [undefined, 'application/json'], ['', 'application/json'], ['*/*', 'application/json'],
  ['application/*', 'application/json'], ['application/json', 'application/json'],
  ['application/*+json', 'application/json'], ['application/vnd.test+json', 'application/vnd.test+json'],
  ['application/problem+json', 'application/problem+json'],
  ['application/json;charset=UTF-8', 'application/json;charset=UTF-8'],
  ['application/xml, application/json;q=.5', 'application/json'],
  ['application/vnd.a+json;q=.2, application/vnd.b+json;q=.9', 'application/vnd.b+json'],
  ['application/json;q=0', 'application/json'],
  ['application/json;q=0x1p-1', 'application/json'], ['application/json;q=.5d', 'application/json'],
  ['application/json;profile="a,b;c"', 'application/json;profile="a,b;c"'],
] as const) test(`negociación JSON: ${String(accept)}`, () => assert.equal(negotiate(accept, jsonTypes), expected));

for (const accept of ['application/xml', 'text/plain', 'image/*']) test(`406 sin representación: ${accept}`, () => {
  assert.throws(() => negotiate(accept, jsonTypes), (error: unknown) => error instanceof HttpProblem
    && error.status === 406 && error.detail === 'Acceptable representations: [application/json, application/*+json].'
    && error.headers.Accept === 'application/json, application/*+json');
});
for (const accept of ['invalid', '*/json', 'application/json;q=NaN', 'application/json;q=2', 'application/json;q=', 'application/json;q=0x1',
  'application/json;profile="unterminated', 'application/json\r\nInjected: x', Array(51).fill('application/json').join(',')]) {
  test(`Accept ilegible: ${JSON.stringify(accept).slice(0, 70)}`, () => {
    assert.throws(() => parseAccept(accept), (error: unknown) => error instanceof HttpProblem && error.detail === 'Could not parse Accept header.');
  });
}
test('cabeceras multivalor sustituyen el valor simple, sin duplicación y sin mutar entradas', () => {
  const input = { Accept: 'application/json' };
  const headers = requestHeaders(input, { aCcEpT: ['application/vnd.a+json;q=.1', 'application/vnd.b+json;q=.9'] });
  assert.equal(negotiate(headers.accept, jsonTypes), 'application/vnd.b+json');
  assert.equal(input.Accept, 'application/json');
});

async function setup() {
  const repository = new MemoryTransactions(); const effects: string[] = [];
  const provider = {
    async validate() { effects.push('validate'); return coupon(); },
    async redeem() { effects.push('redeem'); return { folioCuponId: 'TEST001' }; },
    async generate() { effects.push('generate'); return { coupon: { code: 'TEST002' } }; },
  };
  const auth = new Authentication(config(), secrets);
  const token = (await auth.issue('test-client', 'test-secret'))!.accessToken;
  const app = createApplication(auth, new Coupons(repository, provider));
  const event = (path: string, value?: unknown, accept?: string): HttpEvent => ({ path, httpMethod: value === undefined ? 'GET' : 'POST',
    body: value === undefined ? null : JSON.stringify(value), headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: accept } });
  return { app, event, repository, effects };
}
test('healthcheck rechaza por produces; token inválido prevalece sobre Accept en rutas privadas', async () => {
  const { app, event, effects } = await setup();
  const health = await app(event('/coupons/healthcheck', undefined, 'text/plain'));
  assert.equal(health.statusCode, 406); assert.equal(JSON.parse(health.body).detail, 'Acceptable representations: [application/json].');
  const denied = event('/coupons/generate', generate(), 'invalid'); denied.headers.Authorization = 'Bearer invalid';
  const response = await app(denied); assert.equal(response.statusCode, 401); assert.equal(response.body, '');
  assert.deepEqual(effects, []);
});
test('la negociación de validate ocurre después de guardar y permite consultar inmediatamente', async () => {
  const { app, event, repository, effects } = await setup();
  assert.equal((await app(event('/coupons/validate', request(), 'application/xml'))).statusCode, 406);
  assert.equal((await repository.latest(1, 11, 1, 'TEST001'))?.uid, 'test-uid');
  assert.deepEqual(effects, ['validate']);
});
test('un canje puede confirmarse antes del 406: no se reintenta y deja de estar pendiente', async () => {
  const { app, event, repository, effects } = await setup();
  assert.equal((await app(event('/coupons/validate', request()))).statusCode, 200);
  const response = await app(event('/coupons/redeem', redeem(), 'application/xml'));
  assert.equal(response.statusCode, 406); assert.equal(await repository.latest(1, 11, 1, 'TEST001'), undefined);
  assert.deepEqual(effects, ['validate', 'redeem']);
});
test('generación negocia después del proveedor, sin repetir su operación', async () => {
  const { app, event, effects } = await setup();
  assert.equal((await app(event('/coupons/generate', generate(), 'application/xml'))).statusCode, 406);
  assert.deepEqual(effects, ['generate']);
});
test('DTO inválido no invoca proveedor; ProblemDetail mantiene fallback para un 415', async () => {
  const { app, event, effects } = await setup();
  const invalid = event('/coupons/validate', request()); invalid.body = '{';
  assert.equal((await app(invalid)).statusCode, 400);
  invalid.headers['Content-Type'] = 'text/plain'; invalid.headers.Accept = 'application/xml';
  const response = await app(invalid); assert.equal(response.statusCode, 415);
  assert.equal(response.headers['Content-Type'], 'application/problem+json'); assert.deepEqual(effects, []);
});
test('Accept ilegible después de éxito produce 406 vacío; un error conserva su estado sin cuerpo', async () => {
  const { app, event, effects } = await setup();
  const response = await app(event('/coupons/generate', generate(), 'invalid'));
  assert.equal(response.statusCode, 406); assert.equal(response.body, ''); assert.equal(response.headers['Content-Type'], undefined);
  const invalid = event('/coupons/validate', request(), 'invalid'); invalid.body = '{';
  const error = await app(invalid); assert.equal(error.statusCode, 400); assert.equal(error.body, '');
  assert.deepEqual(effects, ['generate']);
});
test('StringHttpMessageConverter conserva texto literal también al seleccionar JSON o XML', async () => {
  const { app, event } = await setup();
  for (const [accept, expected] of [[undefined, 'text/plain;charset=UTF-8'], ['application/json', 'application/json'], ['application/xml', 'application/xml;charset=UTF-8']]) {
    const result = await app(event('/test-insights', undefined, accept));
    assert.equal(result.statusCode, 200); assert.equal(result.headers['Content-Type'], expected);
    assert.equal(result.body, 'Evento de prueba enviado a Application Insights');
  }
});
test('codificaciones no certificadas conservan UTF-8 y no anuncian bytes de otra codificación', async () => {
  const { app, event } = await setup();
  const response = await app(event('/test-insights', undefined, 'text/plain;charset=UTF-16'));
  assert.equal(response.headers['Content-Type'], 'text/plain;charset=UTF-8');
  assert.equal(response.body, 'Evento de prueba enviado a Application Insights');
});
test('HEAD conserva negociación sin devolver cuerpo; documentación diferencia JSON, YAML y recursos', async () => {
  const { app, event } = await setup();
  const head = event('/coupons/healthcheck', undefined, 'application/xml'); head.httpMethod = 'HEAD';
  assert.equal((await app(head)).statusCode, 406); assert.equal((await app(head)).body, '');
  assert.equal((await app(event('/v3/api-docs', undefined, 'application/xml'))).statusCode, 406);
  assert.equal((await app(event('/v3/api-docs.yaml', undefined, 'application/vnd.oai.openapi'))).statusCode, 200);
  assert.equal((await app(event('/swagger-ui/swagger-ui.css', undefined, 'text/css'))).statusCode, 200);
});
test('catálogo de fallos JVM tipados conserva los mensajes previos sin afirmar certificación', () => {
  for (const code of Object.keys(legacyRuntimeMessages) as (keyof typeof legacyRuntimeMessages)[]) {
    const error = legacyRuntime(code); assert.ok(error instanceof LegacyRuntimeError);
    assert.equal(error.code, code); assert.equal(publicError(error).message, legacyRuntimeMessages[code]);
    assert.equal(publicError(error).status, 400);
  }
});
