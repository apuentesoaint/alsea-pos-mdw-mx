import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('el comando de despliegue ejecuta los controles y se detiene antes de publicar ante cualquier fallo', () => {
  const root = mkdtempSync(join(tmpdir(), 'deployment flow '));
  const trace = join(root, 'trace.jsonl');
  const config = join(root, 'deployment.json');
  const deploy = resolve('dist/scripts/deploy.mjs');
  writeFileSync(config, JSON.stringify({ accountId: '123456789012', parameters: {
    ...Object.fromEntries(['cuponeraTokenUrl', 'cuponeraValidateUrl', 'cuponeraRedeemUrl', 'cuponeraGenerateUrl', 'starbucksBaseUrl', 'openapiDevUrl', 'openapiProdUrl'].map(name => [name, 'https://example.com'])),
    starbucksVersion: '/v1', starbucksTokenPath: '/token', starbucksCouponPath: '/coupons',
    openapiDevUrl: 'http://localhost:8080',
    securitySecretName: 'cuponera-api-security/qa/custom-mdw',
    securitySecretKmsKeyArn: 'arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012',
  } }));
  const childProcessMock = `
    import {appendFileSync, readFileSync} from 'node:fs';
    export function spawnSync(executable, args, options) {
      const script = args[args[0] === '--import' ? 2 : 0];
      const index = args.indexOf('--config');
      const configuration = index < 0 ? undefined : {path:args[index+1], params:JSON.parse(readFileSync(args[index+1], 'utf8')).params.qa};
      appendFileSync(process.env.QUALITY_TEST_TRACE, JSON.stringify({script, args, configuration, credentialsPresent: Boolean(options.env.AWS_ACCESS_KEY_ID)})+'\\n');
      const fail = process.env.QUALITY_TEST_FAIL;
      return {status: script.includes(fail) && fail !== 'none' ? 1 : 0};
    }
  `;
  const bootstrap = `
    import {registerHooks} from 'node:module';
    import {pathToFileURL} from 'node:url';
    import {appendFileSync} from 'node:fs';
    import {STSClient} from ${JSON.stringify(import.meta.resolve('@aws-sdk/client-sts'))};
    import {APIGatewayClient} from ${JSON.stringify(import.meta.resolve('@aws-sdk/client-api-gateway'))};
    const record = event => appendFileSync(process.env.QUALITY_TEST_TRACE, JSON.stringify({event})+'\\n');
    STSClient.prototype.send = async () => {record('identity'); return {Account: '123456789012'};};
    APIGatewayClient.prototype.send = async () => {record('gateway'); return {cloudwatchRoleArn: 'arn:aws:iam::123456789012:role/test-only'};};
    const deploymentUrl = pathToFileURL(${JSON.stringify(deploy)}).href;
    registerHooks({resolve(specifier, context, nextResolve) {
      if (specifier === 'node:child_process' && context.parentURL === deploymentUrl) return {url: ${JSON.stringify('data:text/javascript,' + encodeURIComponent(childProcessMock))}, shortCircuit: true};
      return nextResolve(specifier, context);
    }});
    process.argv = [process.execPath, ${JSON.stringify(deploy)}, '--stage', 'qa', '--config', ${JSON.stringify(config)}, ...(process.env.QUALITY_TEST_EXECUTE === 'true' ? ['--execute'] : [])];
    await import(deploymentUrl);
  `;
  const bootstrapFile = join(root, 'bootstrap.mjs');
  writeFileSync(bootstrapFile, bootstrap);
  const original = JSON.parse(readFileSync(config, 'utf8'));
  const scenarios: Array<[string, boolean, boolean?]> = [['none', true], ['none', false], ['eslint', true], ['lint-infrastructure', true], ['audit-dependencies', true], ['artifact-integrity', true], ['none', true, true], ['lint-infrastructure', true, true]];
  try {
    for (const [failure, execute, empty] of scenarios) {
      writeFileSync(config, JSON.stringify({ ...original, parameters: { ...original.parameters, ...(empty ? { securitySecretKmsKeyArn: '', publicBasePath: '', starbucksVersion: '' } : {}) } }));
      writeFileSync(trace, '');
      const result = spawnSync(process.execPath, [bootstrapFile], {
        encoding: 'utf8', timeout: 15000,
        env: { ...process.env, QUALITY_TEST_TRACE: trace, QUALITY_TEST_FAIL: failure, QUALITY_TEST_EXECUTE: String(execute), AWS_ACCESS_KEY_ID: 'TEST_ONLY' },
      });
      assert.equal(result.status, failure === 'none' ? 0 : 1, result.stderr);
      const entries = readFileSync(trace, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
      assert.deepEqual(entries.slice(0, 2).map(entry => entry.event), ['identity', 'gateway']);
      const commands = entries.filter(entry => entry.script);
      for (const command of commands.filter(entry => entry.args.includes('package') || entry.args.includes('deploy'))) {
        if (empty) {
          assert.equal(command.configuration.params.securitySecretName, 'cuponera-api-security/qa/custom-mdw');
          assert.equal(command.configuration.params.securitySecretKmsKeyArn, '');
          assert.equal(command.configuration.params.publicBasePath, '');
          assert.equal(command.configuration.params.starbucksVersion, '');
          assert.equal(existsSync(command.configuration.path), false, 'Eliminar el archivo también tras un fallo');
        } else {
          assert.ok(command.args.includes('--param=securitySecretName=cuponera-api-security/qa/custom-mdw'));
          assert.ok(command.args.includes('--param=securitySecretKmsKeyArn=arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012'));
        }
      }
      const published = commands.find(entry => entry.args.includes('deploy'));
      if (failure !== 'none') { assert.equal(published, undefined, failure); continue; }
      if (!execute) {
        assert.equal(published, undefined);
        assert.ok(commands.some(entry => entry.script.includes('lint-infrastructure')));
        assert.ok(!commands.some(entry => entry.script.includes('audit-dependencies')));
        continue;
      }
      assert.ok(published);
      const scripts = commands.map(entry => entry.script);
      assert.ok(scripts.findIndex(name => name.includes('eslint')) < scripts.findIndex(name => name.includes('serverless.js')));
      assert.ok(scripts.indexOf('scripts/lint-infrastructure.mjs') < scripts.indexOf('scripts/verify-artifacts.mjs'));
      assert.ok(scripts.indexOf('scripts/audit-dependencies.mjs') < scripts.lastIndexOf('node_modules/serverless/bin/serverless.js'));
      assert.ok(commands.filter(entry => !entry.args.includes('deploy')).every(entry => !entry.credentialsPresent));
      assert.equal(published.credentialsPresent, true);
      if (empty) assert.equal(published.configuration.params.gatewayLogsRoleArn, 'arn:aws:iam::123456789012:role/test-only');
      else assert.ok(published.args.includes('--param=gatewayLogsRoleArn=arn:aws:iam::123456789012:role/test-only'));
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
