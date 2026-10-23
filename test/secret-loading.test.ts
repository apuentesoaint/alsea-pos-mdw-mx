import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('cargar secretos mantiene la protección de rotación y rechaza dummies antes del SDK', () => {
  const root = mkdtempSync(join(tmpdir(), 'secret loading '));
  const trace = join(root, 'calls.jsonl');
  const payload = join(root, 'payload.json');
  const bootstrap = join(root, 'bootstrap.mjs');
  const seed = resolve('dist/scripts/seed-secrets.mjs');
  writeFileSync(bootstrap, `
    import {SecretsManagerClient} from ${JSON.stringify(import.meta.resolve('@aws-sdk/client-secrets-manager'))};
    import {appendFileSync} from 'node:fs';
    import {pathToFileURL} from 'node:url';
    SecretsManagerClient.prototype.send = async command => {
      appendFileSync(process.env.QUALITY_TEST_TRACE, command.constructor.name+'\\n');
      if (process.env.QUALITY_TEST_FAIL === 'true') throw new Error('SENSITIVE_TEST_ONLY');
      if (command.constructor.name === 'PutSecretValueCommand') {
        const {readFileSync} = await import('node:fs');
        const assert = (await import('node:assert/strict')).default;
        assert.deepEqual(JSON.parse(command.input.SecretString), JSON.parse(readFileSync(${JSON.stringify(payload)}, 'utf8')));
        assert.equal(command.input.SecretId, 'cuponera-api-security/dev/aws-mdw');
        assert.match(command.input.ClientRequestToken, /^[a-f0-9-]{36}$/);
      }
      if (command.constructor.name === 'DescribeSecretCommand') return {VersionIdsToStages: process.env.QUALITY_TEST_EXISTING === 'true' ? {test: ['AWSCURRENT']} : {}};
      return {VersionId: 'TEST_VERSION_ONLY'};
    };
    process.argv = [process.execPath, ${JSON.stringify(seed)}, '--id', 'cuponera-api-security/dev/aws-mdw', '--file', ${JSON.stringify(payload)}, ...(process.env.QUALITY_TEST_REPLACE === 'true' ? ['--replace'] : [])];
    await import(pathToFileURL(${JSON.stringify(seed)}).href);
  `);
  const valid = { cuponera_mx_credential: 'TEST_ONLY', jwt_clientId: 'TEST_ONLY', jwt_clientSecret: 'TEST_ONLY'.repeat(6), sbx_client: 'TEST_ONLY', sbx_secret: 'TEST_ONLY' };
  const scenarios: Array<{ value: unknown; existing: boolean; replace: boolean; count: number; status: number; mode?: number; fail?: boolean }> = [
    { value: valid, existing: false, replace: false, count: 2, status: 0 },
    { value: valid, existing: true, replace: false, count: 1, status: 1 },
    { value: valid, existing: true, replace: true, count: 2, status: 0 },
    { value: { ...valid, jwt_clientId: 'REPLACE_ME' }, existing: false, replace: false, count: 0, status: 1 },
    { value: { ...valid, jwt_clientSecret: 'short_TEST_ONLY' }, existing: false, replace: false, count: 0, status: 1 },
    { value: { ...valid, jwt_clientId: ' TEST_ONLY' }, existing: false, replace: false, count: 0, status: 1 },
    { value: valid, existing: false, replace: false, count: 1, status: 1, fail: true },
    ...(process.platform === 'win32' ? [] : [{ value: valid, existing: false, replace: false, count: 0, status: 1, mode: 0o644 }]),
    { value: { ...valid, additional: { test: true } }, existing: false, replace: false, count: 2, status: 0 },
    { value: null, existing: false, replace: false, count: 0, status: 1 },
    { value: { ...valid, cuponera_mx_credential: 'Basic TEST_ONLY' }, existing: false, replace: false, count: 0, status: 1 },
    { value: { ...valid, sbx_secret: 'APISBX_SECRET' }, existing: false, replace: false, count: 0, status: 1 },
    { value: { clientId: 'TEST_ONLY', clientSecret: 'TEST_ONLY' }, existing: false, replace: false, count: 0, status: 1 },
  ];
  try {
    for (const scenario of scenarios) {
      writeFileSync(trace, ''); writeFileSync(payload, JSON.stringify(scenario.value)); chmodSync(payload, scenario.mode ?? 0o600);
      const result = spawnSync(process.execPath, [bootstrap], {
        encoding: 'utf8', timeout: 15000, env: { ...process.env, QUALITY_TEST_TRACE: trace, QUALITY_TEST_FAIL: String(scenario.fail ?? false), QUALITY_TEST_EXISTING: String(scenario.existing), QUALITY_TEST_REPLACE: String(scenario.replace) },
      });
      assert.equal(result.status, scenario.status, result.stderr);
      const calls = readFileSync(trace, 'utf8').trim().split('\n').filter(Boolean);
      assert.equal(calls.length, scenario.count);
      if (scenario.count === 2) assert.deepEqual(calls, ['DescribeSecretCommand', 'PutSecretValueCommand']);
      assert.ok(!(result.stdout + result.stderr).includes('TEST_ONLY'));
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
