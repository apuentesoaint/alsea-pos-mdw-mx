import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const configuration = parse(readFileSync('serverless.yml', 'utf8'));
// Leer solo las inclusiones YAML; la resolución completa se verifica al empaquetar.
function include(reference: string) {
  const match = /^\$\{file\((\.\/infra\/[\w/.-]+\.yml)\)\}$/.exec(reference);
  assert.ok(match, `Inclusión YAML esperada: ${reference}`);
  return parse(readFileSync(match[1]!, 'utf8'));
}
configuration.functions = include(configuration.functions);
configuration.custom.esbuild = include(configuration.custom.esbuild);
const fragments = configuration.resources.map(include);
const resources = { Resources: Object.assign({}, ...fragments.map((fragment: any) => fragment.Resources ?? {})) };

test('el rol regional de logs se propaga como parámetro validado en creación y actualización', () => {
  const stack = fragments.find((fragment: any) => fragment.Parameters?.GatewayLogsRoleArn);
  assert.ok(stack);
  const parameter = stack.Parameters.GatewayLogsRoleArn;
  const pattern = new RegExp(parameter.AllowedPattern);
  assert.ok(pattern.test(''));
  assert.ok(pattern.test('arn:aws:iam::123456789012:role/example'));
  assert.ok(!pattern.test('invalid-role'));
  assert.deepEqual(stack.Conditions.CreateGatewayLogsRole['Fn::Equals'][0], { Ref: 'GatewayLogsRoleArn' });
  assert.deepEqual(resources.Resources.ApiGatewayAccount.Properties.CloudWatchRoleArn['Fn::If'][1], { Ref: 'GatewayLogsRoleArn' });
  // Sin provider.stackParameters: Serverless 3 los envía también al crear el stack inicial y CloudFormation lo rechaza.
  assert.equal(configuration.provider.stackParameters, undefined);
  assert.equal(parameter.Default, '${self:custom.gatewayLogsRoleArn}');
  assert.equal(stack.Parameters.SecuritySecretKmsKeyArn.Default, '${self:custom.securitySecretKmsKeyArn}');
});

test('los módulos YAML no duplican recursos ni contienen configuración externa de entorno', () => {
  const names = fragments.flatMap((fragment: any) => Object.keys(fragment.Resources ?? {}));
  assert.equal(names.length, new Set(names).size);
  for (const reference of configuration.resources) {
    assert.ok(!JSON.stringify(include(reference)).includes('${param:'), 'Los parámetros se centralizan en serverless.yml');
  }
  assert.ok(resources.Resources.TransactionsPOS);
  assert.ok(!resources.Resources.TransactionsTable);
});
test('qa y prod requieren sustituir los endpoints dummy y no heredan stage del Java', () => {
  for (const stage of ['qa', 'prod']) {
    const settings = { ...configuration.params.default, ...configuration.params[stage] };
    for (const key of ['cuponeraTokenUrl', 'cuponeraValidateUrl', 'cuponeraRedeemUrl', 'cuponeraGenerateUrl', 'starbucksBaseUrl']) assert.ok(new URL(settings[key]).hostname.endsWith('.invalid'));
  }
  assert.equal(configuration.params.dev.cuponeraGenerateUrl, 'https://stage.cupones.alsea.com.mx/ext/WSCupones/cupones-api/v1/cupones/generarCuponSocioText');
  for (const key of ['cuponeraTokenUrl', 'cuponeraValidateUrl', 'cuponeraRedeemUrl']) assert.ok(new URL(configuration.params.dev[key]).hostname.endsWith('.invalid'));
});
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
test('el stack consume un solo secreto externo y acota IAM y KMS', () => {
  assert.equal(configuration.provider.environment.SECURITY_SECRET_ID, '${param:securitySecretName}');
  assert.equal(configuration.params.default.securitySecretName, 'cuponera-api-security/${sls:stage}/aws-mdw');
  assert.equal(configuration.params.default.securitySecretKmsKeyArn, '');
  assert.equal(configuration.custom.secretPayloadTemplates, undefined);
  assert.ok(!Object.keys(configuration.provider.environment).some(name => /PASSWORD|CLIENTSECRET|ACCESS_KEY|SECRET_ARN/.test(name)));
  for (const resource of Object.values(resources.Resources) as any[]) assert.ok(!['AWS::SecretsManager::Secret', 'AWS::KMS::Key'].includes(resource.Type));
  for (const name of ['AuthRole', 'ValidateRole', 'RedeemRole', 'GenerateRole', 'LatestRole', 'TechnicalRole']) {
    const statements = resources.Resources[name].Properties.Policies[0].PolicyDocument.Statement;
    const read = statements.filter((statement: any) => statement.Action?.includes('secretsmanager:GetSecretValue'));
    assert.equal(read.length, 1);
    assert.equal(read[0].Resource, '${self:custom.securitySecretArn}');
    assert.equal(read[0].Condition.Bool['aws:SecureTransport'], 'true');
    const decrypt = statements.find((statement: any) => statement['Fn::If'])['Fn::If'];
    assert.equal(decrypt[0], 'HasSecuritySecretKmsKey');
    assert.deepEqual(decrypt[1].Resource, { Ref: 'SecuritySecretKmsKeyArn' });
    assert.equal(decrypt[1].Condition.StringLike['kms:EncryptionContext:SecretARN'], '${self:custom.securitySecretArn}');
    assert.deepEqual(decrypt[2], { Ref: 'AWS::NoValue' });
  }
  assert.ok(configuration.custom.securitySecretArn['Fn::Sub'].endsWith(':secret:${param:securitySecretName}-??????'));
  assert.ok(!JSON.stringify(resources.Resources.MigrationPolicy).includes('secretsmanager:'));
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
