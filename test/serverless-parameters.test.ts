import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { devNull } from 'node:os';
import { withServerlessParameters } from '../scripts/serverless-parameters.js';

test('parámetros vacíos y overrides se resuelven con Serverless 3 real sin modificar el YAML', async () => {
  let temporary: string | undefined;
  await withServerlessParameters('qa', {
    securitySecretName: 'cuponera-api-security/qa/custom-mdw', securitySecretKmsKeyArn: '', starbucksVersion: '', publicBasePath: '',
  }, async args => {
    assert.ok(!args.some(arg => arg.startsWith('--param=')));
    temporary = args[args.indexOf('--config') + 1]!;
    assert.ok(existsSync(temporary));
    const env = { ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('AWS_'))),
      AWS_CONFIG_FILE: devNull, AWS_SHARED_CREDENTIALS_FILE: devNull, AWS_EC2_METADATA_DISABLED: 'true', SLS_TELEMETRY_DISABLED: '1', SLS_DISABLE_AUTO_UPDATE: '1' };
    const result = spawnSync(process.execPath, ['--import', './scripts/toolchain-compat.mjs', 'node_modules/serverless/bin/serverless.js', 'print', '--format', 'json', ...args], { encoding: 'utf8', env, timeout: 30000, maxBuffer: 2 * 1024 * 1024 });
    assert.equal(result.status, 0, result.stderr);
    const resolved = JSON.parse(result.stdout);
    assert.equal(resolved.provider.environment.SECURITY_SECRET_ID, 'cuponera-api-security/qa/custom-mdw');
    assert.equal(resolved.provider.environment.APISBX_VERSION, '');
    assert.equal(resolved.provider.environment.PUBLIC_BASE_PATH, '');
    assert.equal(resolved.provider.stackParameters.find((param: { ParameterKey: string }) => param.ParameterKey === 'SecuritySecretKmsKeyArn').ParameterValue, '');
    assert.ok(resolved.functions.auth);
    assert.ok(resolved.resources.Resources.AuthRole);
  });
  assert.ok(temporary); assert.equal(existsSync(temporary), false);
});

test('el archivo temporal se elimina si falla el consumidor y los no vacíos conservan el CLI', async () => {
  let temporary: string | undefined;
  await assert.rejects(withServerlessParameters('prod', { securitySecretKmsKeyArn: '' }, async args => {
    temporary = args[args.indexOf('--config') + 1]!;
    throw new Error('TEST_ONLY');
  }), /TEST_ONLY/);
  assert.ok(temporary); assert.equal(existsSync(temporary), false);
  await withServerlessParameters('dev', { securitySecretName: 'test/security' }, async args => {
    assert.deepEqual(args, ['--stage', 'dev', '--param=securitySecretName=test/security']);
  });
});
