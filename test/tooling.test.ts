import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deploymentConfiguration, DeploymentConfigurationError } from '../scripts/deployment-config.js';
import { validateSecretPayload } from '../scripts/secret-payload.js';
import { validateSqlConfiguration } from '../scripts/sql-configuration.js';

function configuration() {
  return { accountId: '123456789012', parameters: Object.fromEntries([
    ...['cuponeraTokenUrl', 'cuponeraValidateUrl', 'cuponeraRedeemUrl', 'cuponeraGenerateUrl', 'starbucksBaseUrl', 'openapiDevUrl', 'openapiProdUrl'].map(name => [name, 'https://example.com']),
    ['starbucksTokenPath', '/token'], ['starbucksCouponPath', '/coupons'], ['starbucksVersion', '/v1'], ['publicBasePath', '/qa'],
  ]) };
}
test('despliegue valida configuración antes de contactar AWS y no publica fragmentos JSON', () => {
  assert.equal(deploymentConfiguration(JSON.stringify(configuration())).accountId, '123456789012');
  assert.throws(() => deploymentConfiguration('{"password":"SENSITIVE_TEST_ONLY",'), error => error instanceof DeploymentConfigurationError && !error.message.includes('SENSITIVE_TEST_ONLY'));
  for (const invalid of [null, {}, { ...configuration(), accountId: 123456789012 }, { ...configuration(), parameters: { ...configuration().parameters, password: 'TEST_ONLY' } }]) {
    assert.throws(() => deploymentConfiguration(JSON.stringify(invalid)), DeploymentConfigurationError);
  }
  for (const url of ['http://example.com', 'https://user:TEST_ONLY@example.com', 'https://example.invalid', 'https://EXAMPLE.INVALID.']) {
    assert.throws(() => deploymentConfiguration(JSON.stringify({ ...configuration(), parameters: { ...configuration().parameters, cuponeraTokenUrl: url } })), DeploymentConfigurationError);
  }
});

test('el despliegue rechaza rutas y versiones dummy aunque las URLs ya sean reales', () => {
  for (const field of ['starbucksVersion', 'starbucksTokenPath', 'starbucksCouponPath']) {
    assert.throws(() => deploymentConfiguration(JSON.stringify({ ...configuration(), parameters: { ...configuration().parameters, [field]: '/REPLACE_ME_PATH' } })), DeploymentConfigurationError);
  }
});

test('la documentación de desarrollo admite HTTP solo en loopback sin relajar las integraciones', () => {
  for (const url of ['http://localhost:8080', 'http://127.0.0.1:8080', 'http://[::1]:8080']) {
    const config = configuration(); config.parameters.openapiDevUrl = url;
    assert.doesNotThrow(() => deploymentConfiguration(JSON.stringify(config)));
    config.parameters.cuponeraTokenUrl = url;
    assert.throws(() => deploymentConfiguration(JSON.stringify(config)), DeploymentConfigurationError);
  }
  for (const url of ['http://example.com', 'http://localhost.example.com', 'http://user:TEST_ONLY@localhost:8080']) {
    const config = configuration(); config.parameters.openapiDevUrl = url;
    assert.throws(() => deploymentConfiguration(JSON.stringify(config)), DeploymentConfigurationError);
  }
});

test('la configuración SQL privada preserva puertos válidos y rechaza dummies', () => {
  const sql = { host: 'localhost', username: 'TEST_ONLY', password: 'TEST_ONLY', dbname: 'TEST_ONLY' };
  for (const port of [1, 1433, 65535, '1433', undefined]) assert.doesNotThrow(() => validateSqlConfiguration({ ...sql, port }));
  for (const port of [0, -1, 65536, 1.5, 'invalid', '', true, null, {}]) assert.throws(() => validateSqlConfiguration({ ...sql, port }));
  for (const input of [null, [], {}, { ...sql, host: 'REPLACE_ME' }]) assert.throws(() => validateSqlConfiguration(input));
});

test('el despliegue admite el nombre único y una clave KMS concreta, rechazando recursos amplios', () => {
  const config = configuration();
  for (const parameters of [
    { securitySecretName: 'cuponera-api-security/qa/aws-mdw', securitySecretKmsKeyArn: '' },
    { securitySecretKmsKeyArn: 'arn:aws:kms:us-east-1:123456789012:key/test-only' },
  ]) assert.doesNotThrow(() => deploymentConfiguration(JSON.stringify({ ...config, parameters: { ...config.parameters, ...parameters } })));
  for (const parameters of [{ securitySecretName: '*' }, { securitySecretName: '' }, { securitySecretKmsKeyArn: '*' }]) assert.throws(() => deploymentConfiguration(JSON.stringify({ ...config, parameters: { ...config.parameters, ...parameters } })));
});

test('la carga única rechaza campos ausentes, esquemas antiguos y marcadores sin filtrar valores', () => {
  const valid = { cuponera_mx_credential: 'TEST_ONLY', jwt_clientId: 'TEST_ONLY', jwt_clientSecret: 'TEST_ONLY'.repeat(6), sbx_client: 'TEST_ONLY', sbx_secret: 'TEST_ONLY' };
  assert.doesNotThrow(() => validateSecretPayload(valid));
  for (const field of Object.keys(valid)) {
    for (const value of [undefined, null, '', ' ', 'REPLACE_ME', ' TEST_ONLY', 'TEST_ONLY ', 'TEST_ONLY\r\n']) assert.throws(() => validateSecretPayload({ ...valid, [field]: value }));
  }
  for (const value of [null, [], {}, { clientId: 'TEST_ONLY', clientSecret: 'TEST_ONLY' },
    { ...valid, cuponera_mx_credential: ' Basic TEST_ONLY' }, { ...valid, sbx_client: 'APISBX_CLIENT' }, { ...valid, sbx_secret: 'APISBX_SECRET' }]) assert.throws(() => validateSecretPayload(value));
});

test('credenciales de proveedores incompatibles con Headers se rechazan antes de AWS', () => {
  const valid = { cuponera_mx_credential: 'TEST_ONLY', jwt_clientId: 'TEST_ONLY', jwt_clientSecret: 'TEST_ONLY'.repeat(6), sbx_client: 'TEST_ONLY', sbx_secret: 'TEST_ONLY' };
  for (const field of ['cuponera_mx_credential', 'sbx_client', 'sbx_secret']) {
    for (const value of ['TEST_ONLY\r\nheader', 'TEST_ONLY\0', 'TEST_ONLY_😀']) assert.throws(() => validateSecretPayload({ ...valid, [field]: value }), error => error instanceof Error && !error.message.includes('TEST_ONLY'));
  }
  assert.doesNotThrow(() => validateSecretPayload({ ...valid, jwt_clientId: 'TEST_ONLY_😀', jwt_clientSecret: 'á'.repeat(24) }));
});

test('los parámetros públicos no ejecutan resolutores de secretos ni variables del framework', () => {
  const config = configuration();
  for (const value of ['/${ssm:/TEST_ONLY}', '/${env:TEST_ONLY}', '/{{resolve:secretsmanager:TEST_ONLY}}']) {
    assert.throws(() => deploymentConfiguration(JSON.stringify({ ...config, parameters: { ...config.parameters, starbucksVersion: value } })), DeploymentConfigurationError);
  }
});
