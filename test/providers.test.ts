import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DigitalCoupons } from '../src/infrastructure/providers.js';
import { ExternalHttpError, transport, type HttpTransport } from '../src/infrastructure/http.js';
import { config, coupon, generate, request, redeem, secrets } from './fixtures.js';
import type { Transaction } from '../src/core/types.js';

test('validación envía query y zona originales y reutiliza el token', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const http: HttpTransport = async (url, init) => {
    calls.push({ url, init }); return { status: 200, text: url.includes('/token') ? '{"access_token":"TEST","expires_in":3600}' : JSON.stringify({ ...coupon(), fcUID: '' }) };
  };
  const provider = new DigitalCoupons(config(), secrets, http);
  const input = request(); input.countryId = 3;
  assert.equal((await provider.validate(input, 'generated')).fcUID, 'generated'); await provider.validate(input, 'generated2');
  assert.equal(calls.filter(value => value.url.includes('/token')).length, 1);
  assert.equal(new URL(calls[1]!.url).searchParams.get('fiPaisID'), '3');
  assert.equal(new Headers(calls[1]!.init.headers).get('timeZone'), '-3');
  assert.equal(new URL(calls[1]!.url).searchParams.has('fcUID'), false);
});
test('Starbucks usa las cabeceras y firma del Java y renueva una vez ante 401', async () => {
  const calls: { url: string; init: RequestInit }[] = []; let validations = 0;
  const http: HttpTransport = async (url, init) => {
    calls.push({ url, init });
    if (url === 'https://starbucks.invalid/v1/token') return { status: 200, text: '{"access_token":"SBXTEST","expires_in":3600}' };
    if (url === 'https://starbucks.invalid/v1/coupons') { validations++; if (validations === 1) throw new ExternalHttpError(401, '{}'); return { status: 200, text: '{"FolioCupon1":"CONVERTED"}' }; }
    if (url.includes('/token')) return { status: 200, text: '{"access_token":"TEST","expires_in":3600}' };
    return { status: 200, text: JSON.stringify(coupon()) };
  };
  const provider = new DigitalCoupons(config(), secrets, http, () => 1_700_000_000_000); const input = request(); input.brandId = 10;
  await provider.validate(input, 'uid'); assert.equal(input.couponCode, 'CONVERTED'); assert.equal(validations, 2);
  const headers = new Headers(calls[0]!.init.headers);
  assert.equal(headers.get('x-api-key'), 'test-client'); assert.equal(headers.get('client-secret'), 'test-secret');
  assert.equal(headers.get('sig'), createHash('sha256').update('test-clienttest-secret1700000000').digest('hex'));
  assert.equal(calls[0]!.init.body, '{"": ["{}"]}');
});
test('generate conserva transformación FMR/OZ/S8 y no transmite campos adicionales', async () => {
  let payload: unknown; const http: HttpTransport = async (url, init) => {
    if (url.includes('/token')) return { status: 200, text: '{"access_token":"TEST","expires_in":3600}' };
    payload = JSON.parse(String(init.body)); return { status: 200, text: '{"fcFolioCuponID":"GENERATED"}' };
  };
  const provider = new DigitalCoupons(config(), secrets, http);
  assert.deepEqual(await provider.generate(generate()), { coupon: { code: 'GENERATED' } });
  assert.deepEqual(payload, { fcSocioID: 'test-user', cuponReq: { fcCampanaID: 'FMR', fcPromocionID: 'OZ', fiPaisID: 1 } });
  const second = generate(); second.request.coupon_type = 2; await provider.generate(second);
  assert.equal((payload as { cuponReq: { fcPromocionID: string } }).cuponReq.fcPromocionID, 'S8');
});
test('mock de generate reproduce códigos de la implementación Java', async () => {
  const provider = new DigitalCoupons({ ...config(), generateMock: true }, secrets, async () => { throw new Error('No debe llamar al proveedor'); });
  assert.equal((await provider.generate(generate())).coupon.code, 'MXSJH00981');
  const input = generate(); input.request.coupon_type = 2; assert.equal((await provider.generate(input)).coupon.code, 'MXSJH00982');
});
test('4xx de validate conserva consumerMessage sin reintentar la operación', async () => {
  let calls = 0; const provider = new DigitalCoupons(config(), secrets, async url => {
    if (url.includes('/token')) return { status: 200, text: '{"access_token":"TEST","expires_in":3600}' };
    calls++; throw new ExternalHttpError(400, '{"consumerMessage":"Cupón expirado"}');
  });
  await assert.rejects(provider.validate(request(), 'uid'), /Cupón expirado/); assert.equal(calls, 1);
});
test('redeem consulta Starbucks también para BK y mantiene zona -4 para Chile', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const provider = new DigitalCoupons(config(), secrets, async (url, init) => {
    calls.push({ url, init });
    if (url.includes('/token')) return { status: 200, text: '{"access_token":"TEST","expires_in":3600}' };
    return { status: 200, text: url.includes('starbucks') ? '{"FolioCupon1":"NEWCODE"}' : '{"folioCuponId":"NEWCODE"}' };
  });
  const input = redeem(); input.countryId = 3;
  await provider.redeem(input, { redemptionToken: 'TEST_ONLY' } as Transaction);
  assert.ok(calls.some(value => value.url.includes('starbucks')));
  const outgoing = calls.at(-1)!; assert.equal(new Headers(outgoing.init.headers).get('timeZone'), '-4');
  assert.equal(JSON.parse(String(outgoing.init.body)).folioCuponId, 'NEWCODE');
});
test('timeout de un POST nunca causa un segundo envío', async () => {
  let calls = 0; const provider = new DigitalCoupons(config(), secrets, async url => {
    if (url.includes('/token')) return { status: 200, text: '{"access_token":"TEST","expires_in":3600}' };
    calls++; throw new DOMException('Timeout', 'TimeoutError');
  });
  await assert.rejects(provider.generate(generate())); assert.equal(calls, 1);
});
test('transporte rechaza HTTP no local y descarta redirecciones automáticas', async () => {
  const http = transport(5000, async (_url, init) => { assert.equal(init?.redirect, 'manual'); return new Response('{}', { status: 302 }); });
  await assert.rejects(http('http://provider.invalid', {}, 'cuponera', 'validate'), /HTTPS/);
  assert.equal((await http('https://provider.invalid', {}, 'cuponera', 'validate')).status, 302);
});
test('ticketId inválido se rechaza antes de obtener token Cuponera o enviar un canje', async () => {
  const operations: string[] = [];
  const provider = new DigitalCoupons(config(), secrets, async (url, _init, service, operation) => {
    operations.push(`${service}.${operation}`);
    if (url.includes('/token')) return { status: 200, text: '{"access_token":"TEST","expires_in":3600}' };
    return { status: 200, text: '{"FolioCupon1":"CONVERTED","folioCuponId":"CONVERTED"}' };
  });
  for (const ticketId of ['1.5', '0x10', '', '2147483648']) {
    const input = redeem(); input.ticketId = ticketId;
    await assert.rejects(provider.redeem(input, { redemptionToken: 'TEST_ONLY' } as Transaction), /For input string/);
  }
  assert.ok(!operations.includes('cuponera.redeem')); assert.ok(!operations.includes('cuponera.token'));
});
test('generate acepta fcFolioCuponID escalar como JsonNode.asText y rechaza objetos', async () => {
  let response: unknown = 123;
  const provider = new DigitalCoupons(config(), secrets, async url => url.includes('/token')
    ? { status: 200, text: '{"access_token":"TEST","expires_in":3600}' }
    : { status: 200, text: JSON.stringify({ fcFolioCuponID: response }) });
  assert.equal((await provider.generate(generate())).coupon.code, '123');
  response = {};
  await assert.rejects(provider.generate(generate()), /no contiene fcFolioCuponID/);
});
test('validate convierte los fallos de mapeo en el mensaje general del catch Java', async () => {
  const provider = new DigitalCoupons(config(), secrets, async url => url.includes('/token')
    ? { status: 200, text: '{"access_token":"TEST","expires_in":3600}' }
    : { status: 200, text: 'not JSON' });
  await assert.rejects(provider.validate(request(), 'uid'), error => error instanceof Error && error.message === 'Se produjo una excepción. ');
});
test('un 401 del token Starbucks no reenvía el POST ni se confunde con el GET de cupón', async () => {
  let starbucksTokens = 0;
  const provider = new DigitalCoupons(config(), secrets, async url => {
    if (url.includes('starbucks')) { starbucksTokens++; throw new ExternalHttpError(401, '{}'); }
    if (url.includes('/token')) return { status: 200, text: '{"access_token":"TEST","expires_in":3600}' };
    assert.ok(url.includes('/null?')); return { status: 200, text: JSON.stringify(coupon()) };
  });
  const input = request(); input.brandId = 10;
  await provider.validate(input, 'uid'); assert.equal(starbucksTokens, 1);
});
test('validate conserva texto de 5xx mientras redeem lo transforma como en su catch Java', async () => {
  const provider = new DigitalCoupons(config(), secrets, async url => {
    if (url.includes('/token')) return { status: 200, text: '{"access_token":"TEST","expires_in":3600}' };
    throw new ExternalHttpError(500, 'LOCAL_TEST_ERROR');
  });
  await assert.rejects(provider.validate(request(), 'uid'), /500 Internal Server Error: "LOCAL_TEST_ERROR"/);
  await assert.rejects(provider.redeem(redeem(), { redemptionToken: null } as Transaction), /servicio de cuponera/);
});
