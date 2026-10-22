import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deploymentConfiguration, DeploymentConfigurationError } from '../scripts/deployment-config.js';

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
  for (const url of ['http://example.com', 'https://user:TEST_ONLY@example.com', 'https://example.invalid']) {
    assert.throws(() => deploymentConfiguration(JSON.stringify({ ...configuration(), parameters: { ...configuration().parameters, cuponeraTokenUrl: url } })), DeploymentConfigurationError);
  }
});
