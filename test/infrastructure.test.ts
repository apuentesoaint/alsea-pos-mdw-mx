import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const configuration = parse(readFileSync('serverless.yml', 'utf8'));
const { resources } = await import(pathToFileURL(resolve('infra/resources.js')).href);
test('configuración fija Node.js 24, Framework 3.40.0 y empaquetado ESM', () => {
  assert.equal(configuration.frameworkVersion, '3.40.0'); assert.equal(configuration.provider.runtime, 'nodejs24.x');
  assert.equal(configuration.configValidationMode, 'error'); assert.equal(configuration.custom.esbuild.target, 'node24');
  assert.equal(configuration.custom.esbuild.format, 'esm'); assert.equal(configuration.custom.esbuild.outputFileExtension, '.mjs');
  assert.equal(configuration.custom.esbuild.alias.yaml, './node_modules/yaml/browser/index.js');
  assert.ok(configuration.plugins.indexOf('./plugins/node24.mjs') < configuration.plugins.indexOf('serverless-esbuild'));
});
test('los recursos explícitos reciben métodos alternativos para aplicar la seguridad y errores heredados', () => {
  const events = Object.values(configuration.functions).flatMap((fn: any) => fn.events.map((event: any) => event.http));
  for (const event of events.filter((event: any) => event.method !== 'any')) {
    assert.ok(events.some((fallback: any) => fallback.path === event.path && fallback.method === 'any'));
  }
});
test('logs del gateway no registran cuerpos y no habilitan CORS indiscriminado', () => {
  assert.equal(configuration.provider.logs.restApi.fullExecutionData, false);
  assert.ok(!JSON.stringify(configuration.provider.logs).toLowerCase().includes('authorization'));
  assert.ok(Object.values(configuration.functions).every((fn: unknown) => !JSON.stringify(fn).includes('"cors":true')));
});
test('variables de entorno contienen referencias de secretos, sin credenciales en texto', () => {
  for (const name of ['AUTH_SECRET_ARN', 'SIGNING_SECRET_ARN', 'CUPONERA_SECRET_ARN', 'STARBUCKS_SECRET_ARN']) assert.ok(configuration.provider.environment[name].Ref);
  assert.ok(!Object.keys(configuration.provider.environment).some(name => /PASSWORD|CLIENTSECRET|ACCESS_KEY/.test(name)));
});
test('alarma DynamoDB usa dimensiones publicadas y retiene la política del bucket retenido', () => {
  const map = resources.Resources;
  assert.equal(map.DetailsBucketPolicy.DeletionPolicy, 'Retain');
  const queries = map.ThrottlesAlarm.Properties.Metrics.filter((query: any) => query.MetricStat);
  assert.equal(queries.length, 4);
  for (const query of queries) assert.deepEqual(query.MetricStat.Metric.Dimensions.map((dimension: any) => dimension.Name), ['TableName', 'Operation']);
  assert.equal(map.LatencyAlarm.Properties.ExtendedStatistic, 'p95');
  assert.ok(map.LambdaErrorsAlarm); assert.ok(map.LambdaThrottlesAlarm);
});
