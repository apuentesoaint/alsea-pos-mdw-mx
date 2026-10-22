import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import { syncBuiltinESMExports } from 'node:module';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';

assert.equal(Number(process.versions.node.split('.')[0]), 24);
// Impide cualquier salida a AWS/proveedores aunque una configuración de SDK ignore el endpoint local.
for (const module of [http, https]) {
  const original = module.request;
  module.request = function (options, ...args) {
    const hostname = typeof options === 'string' || options instanceof URL ? new URL(options).hostname : options.hostname ?? options.host;
    assert.ok(['127.0.0.1', 'localhost'].includes(hostname), 'Prueba sin salida de red externa');
    return Reflect.apply(original, this, [options, ...args]);
  };
}
syncBuiltinESMExports();
const originalFetch = globalThis.fetch;
globalThis.fetch = (url, options) => {
  assert.equal(new URL(url instanceof Request ? url.url : url).hostname, '127.0.0.1');
  return originalFetch(url, options);
};

const records = new Map(); const objects = new Map(); const calls = new Map();
const secrets = {
  'local/auth': { clientId: randomBytes(12).toString('hex'), clientSecret: randomBytes(24).toString('hex') },
  'local/signing': { keyBase64: randomBytes(48).toString('base64') },
  'local/cuponera': { basic: 'LOCAL_SIMULATION' },
  'local/starbucks': { clientId: 'LOCAL_SIMULATION', clientSecret: 'LOCAL_SIMULATION' },
};
const key = value => `${value.PK.S}\u0000${value.SK.S}`;
const server = http.createServer(async (request, response) => {
  try {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    const raw = Buffer.concat(chunks);
    const target = request.headers['x-amz-target'];
    const url = new URL(request.url, 'http://127.0.0.1');
    calls.set(target ?? `${request.method} ${url.pathname}`, (calls.get(target ?? `${request.method} ${url.pathname}`) ?? 0) + 1);
    const send = value => response.writeHead(200, { 'Content-Type': 'application/x-amz-json-1.1' }).end(JSON.stringify(value));
    if (target?.endsWith('.GetSecretValue')) {
      const input = JSON.parse(raw); assert.ok(secrets[input.SecretId]);
      return send({ SecretString: JSON.stringify(secrets[input.SecretId]) });
    }
    if (target?.startsWith('DynamoDB_')) {
      const input = JSON.parse(raw);
      if (target.endsWith('.TransactWriteItems')) {
        for (const item of input.TransactItems) {
          if (item.Put) records.set(key(item.Put.Item), item.Put.Item);
          if (item.Delete) records.delete(key(item.Delete.Key));
        }
        return send({});
      }
      if (target.endsWith('.PutItem')) { records.set(key(input.Item), input.Item); return send({}); }
      if (target.endsWith('.GetItem')) return send({ Item: records.get(key(input.Key)) });
      if (target.endsWith('.Query')) {
        const items = [...records.values()].filter(item => item.PK.S === input.ExpressionAttributeValues[':pk'].S && item.SK.S.startsWith('VALIDATED#'))
          .sort((left, right) => right.SK.S.localeCompare(left.SK.S)).slice(0, 1);
        return send({ Items: items });
      }
      throw new Error('Operación DynamoDB no prevista');
    }
    if (url.pathname.startsWith('/local-bucket/')) {
      if (request.method === 'PUT') { objects.set(url.pathname, raw); response.writeHead(200, { 'x-amz-version-id': 'local-version' }).end(); return; }
      if (request.method === 'GET') { assert.ok(objects.has(url.pathname)); response.writeHead(200).end(objects.get(url.pathname)); return; }
    }
    if (url.pathname.endsWith('/token')) return send({ access_token: 'LOCAL_SIMULATION', expires_in: 3600 });
    if (url.pathname === '/sbx/coupons') return send({ FolioCupon1: 'LOCAL001' });
    if (url.pathname.startsWith('/provider/coupons/')) return send({ fcUID: '', fcTokenRedencion: 'LOCAL_SIMULATION', cupon: { fcFolioCuponID: 'LOCAL001', fiTipoPromocionID: 1, fcValorCupon: '20' }, restricciones: [], fcCampoAdicion2: '{}' });
    if (url.pathname === '/provider/redeem') return send({ folioCuponId: 'LOCAL001' });
    if (url.pathname === '/provider/generate') return send({ fcFolioCuponID: 'LOCAL002' });
    throw new Error('Ruta de simulación no prevista');
  } catch { response.writeHead(500).end('{}'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
Object.assign(process.env, {
  AWS_REGION: 'us-east-1', AWS_ACCESS_KEY_ID: 'LOCAL_SIMULATION', AWS_SECRET_ACCESS_KEY: randomBytes(32).toString('hex'), AWS_SESSION_TOKEN: '',
  AWS_EC2_METADATA_DISABLED: 'true', AWS_IGNORE_CONFIGURED_ENDPOINT_URLS: 'false',
  AWS_ENDPOINT_URL: base, AWS_ENDPOINT_URL_DYNAMODB: base, AWS_ENDPOINT_URL_S3: base, AWS_ENDPOINT_URL_SECRETS_MANAGER: base,
  AUTH_SECRET_ARN: 'local/auth', SIGNING_SECRET_ARN: 'local/signing', CUPONERA_SECRET_ARN: 'local/cuponera', STARBUCKS_SECRET_ARN: 'local/starbucks',
  TRANSACTIONS_TABLE: 'local-table', DETAILS_BUCKET: 'local-bucket', CUPONERA_URI_TOKEN: `${base}/provider/token`,
  CUPONERA_URI_VALIDATE_V1: `${base}/provider/coupons/`, CUPONERA_URI_REDEEM_V1: `${base}/provider/redeem`, CUPONERA_URI_GENERATE: `${base}/provider/generate`,
  APISBX_URI: base, APISBX_VERSION: '/sbx', APISBX_PATH_TOKEN: '/token', APISBX_PATH_SERVICE_COUPONS: '/coupons', GENERATE_MOCK: 'false',
});
const root = resolve('.cache/artifact-check');
const packageDirectory = process.argv[2] ?? '.serverless';
const template = JSON.parse(await readFile(resolve(packageDirectory, 'cloudformation-template-update-stack.json'), 'utf8'));
const stage = Object.values(template.Resources).find(resource => resource.Type === 'AWS::Lambda::Function').Properties.Environment.Variables.STAGE;
process.env.STAGE = stage;
const handlers = {};
const invoke = (operation, path, method, body = null, token, queryStringParameters) => handlers[operation]({ httpMethod: method, path, body: body === null ? null : JSON.stringify(body), headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, queryStringParameters });
try {
  for (const operation of ['auth', 'validate', 'latest', 'redeem', 'generate', 'technical']) {
    handlers[operation] = (await import(pathToFileURL(resolve(root, stage, operation, `src/handlers/${operation}.mjs`)).href)).handler;
  }
  const unacceptable = await handlers.technical({ httpMethod: 'GET', path: '/coupons/healthcheck', body: null, headers: { Accept: 'text/plain' } });
  assert.equal(unacceptable.statusCode, 406);
  assert.equal(JSON.parse(unacceptable.body).detail, 'Acceptable representations: [application/json].');
  const login = await invoke('auth', '/auth/token', 'POST', secrets['local/auth']);
  assert.equal(login.statusCode, 200); const token = JSON.parse(login.body).accessToken; assert.ok(token);
  const request = { countryId: 1, brandId: 11, storeId: 1, posId: 1, orderNumber: 1, couponCode: 'LOCAL001', typeOrder: '1', totalOrder: 100,
    itemsOrder: [{ idItem: 1, familyId: 1, quantity: 1, amount: 100, comment: 'x'.repeat(301 * 1024) }] };
  const validation = await invoke('validate', '/coupons/validate', 'POST', request, token);
  assert.equal(validation.statusCode, 200); const result = JSON.parse(validation.body); assert.equal(result.data.totalDiscount, 20);
  assert.equal(objects.size, 1, 'Detalle grande enviado por el SDK S3 real al servidor local');
  assert.equal(JSON.parse([...objects.values()][0].toString('utf8'))[0].comment.length, 301 * 1024);
  const query = { countryId: '1', brandId: '11', storeId: '1', couponCode: 'LOCAL001' };
  assert.equal(JSON.parse((await invoke('latest', '/coupons/transaction/latest', 'GET', null, token, query)).body).data.uid, result.uid);
  const vendor = await handlers.latest({ httpMethod: 'GET', path: '/coupons/transaction/latest', body: null, queryStringParameters: query,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.cuponera+json' } });
  assert.equal(vendor.statusCode, 200); assert.equal(vendor.headers['Content-Type'], 'application/vnd.cuponera+json');
  assert.equal(JSON.parse(vendor.body).data.uid, result.uid);
  const redemption = await invoke('redeem', '/coupons/redeem', 'POST', { ...request, posID: '1', uid: result.uid, totalDiscountOrder: 20, totalOrderWithOutDiscount: 100,
    totalOrder: 80, employeID: 1, ticketId: '1', fechaCanje: '2026-10-22', paymentMethodId: '1,2,1' }, token);
  assert.equal(redemption.statusCode, 200); assert.equal(JSON.parse(redemption.body).data.code, '000');
  assert.deepEqual([...records.values()].find(item => item.SK.S === 'META').payments.L.map(item => Number(item.N)), [1, 2, 1]);
  assert.equal(JSON.parse((await invoke('latest', '/coupons/transaction/latest', 'GET', null, token, query)).body).data, null);
  assert.equal(calls.get('POST /provider/redeem'), 1);
  const generated = await invoke('generate', '/coupons/generate', 'POST', { request: { campaign_id: 'local', coupon_type: 1, broadcast_channel: 'app', brandId: 60, countryId: 1 }, customer: { id: 'local', name: 'Local' } }, token);
  assert.equal(generated.statusCode, 200); assert.equal(JSON.parse(generated.body).data.coupon.code, 'LOCAL002');
  const directory = process.cwd();
  try {
    process.chdir(resolve(root, stage, 'technical'));
    assert.equal((await invoke('technical', '/swagger-ui/index.html', 'GET')).statusCode, 200);
    const yaml = await invoke('technical', '/v3/api-docs.yaml', 'GET', null, token);
    assert.equal(yaml.statusCode, 200); assert.match(yaml.body, /openapi:/);
    const icon = await invoke('technical', '/swagger-ui/favicon-16x16.png', 'GET');
    assert.equal(icon.statusCode, 200); assert.equal(icon.isBase64Encoded, true); assert.equal(Buffer.from(icon.body, 'base64')[0], 137);
  } finally { process.chdir(directory); }
  console.info(`${stage}: ZIP ESM con SDK v3 real contra simulación local: JWT, validate, S3, latest, redeem, generate, Accept y Swagger aprobados.`);
} finally {
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
