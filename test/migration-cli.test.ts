import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('el importador elige una fuente explícita, conserva SQL con TLS y no consulta otros secretos', () => {
  const root = mkdtempSync(join(tmpdir(), 'migration sources '));
  const trace = join(root, 'trace.jsonl'); const sqlConfig = join(root, 'sql.json');
  const input = join(root, 'input.jsonl'); const output = join(root, 'output.jsonl');
  const migration = resolve('dist/scripts/migrate.mjs');
  const bootstrap = join(root, 'bootstrap.mjs');
  writeFileSync(input, '', { mode: 0o600 });
  writeFileSync(bootstrap, `
    import sql from ${JSON.stringify(import.meta.resolve('mssql'))};
    import {SecretsManagerClient} from ${JSON.stringify(import.meta.resolve('@aws-sdk/client-secrets-manager'))};
    import {DynamoDBClient} from ${JSON.stringify(import.meta.resolve('@aws-sdk/client-dynamodb'))};
    import {S3Client} from ${JSON.stringify(import.meta.resolve('@aws-sdk/client-s3'))};
    import {appendFileSync} from 'node:fs';
    import {pathToFileURL} from 'node:url';
    const record = value => appendFileSync(process.env.QUALITY_TEST_TRACE, JSON.stringify(value)+'\\n');
    for (const client of [SecretsManagerClient, DynamoDBClient, S3Client]) client.prototype.send = async () => {record({event:'unexpected.aws'}); throw new Error('AWS no permitido');};
    sql.ConnectionPool.prototype.connect = async function () {
      record({event:'sql.connect', encrypt:this.config.options.encrypt, trustServerCertificate:this.config.options.trustServerCertificate, port:this.config.port});
      return this;
    };
    sql.ConnectionPool.prototype.request = function () {return {input(){return this;}, async query(){record({event:'sql.query'});return {recordset:[]};}};};
    sql.ConnectionPool.prototype.close = async function () {record({event:'sql.close'});};
    process.argv = [process.execPath, ${JSON.stringify(migration)}, ...JSON.parse(process.env.QUALITY_TEST_ARGS)];
    await import(pathToFileURL(${JSON.stringify(migration)}).href);
  `);
  const valid = { host: 'localhost', username: 'SENSITIVE_TEST_ONLY', password: 'SENSITIVE_TEST_ONLY', dbname: 'test', port: '1433' };
  const scenarios: Array<{ args: string[]; sql: boolean; status: number; value?: unknown; mode?: number }> = [
    { args: ['--file', input], sql: false, status: 0 },
    { args: ['--sql-config', sqlConfig], sql: true, status: 0 },
    { args: ['--sql-config', sqlConfig, '--export', output], sql: true, status: 0 },
    { args: ['--file', input, '--sql-config', sqlConfig], sql: false, status: 1 },
    { args: ['--file', input, '--export', output], sql: false, status: 1 },
    { args: ['--sql-config', sqlConfig], sql: false, status: 1, value: { ...valid, port: 'invalid' } },
    { args: ['--sql-config', sqlConfig], sql: false, status: 1, value: null },
    ...(process.platform === 'win32' ? [] : [{ args: ['--sql-config', sqlConfig], sql: false, status: 1, mode: 0o644 }]),
    { args: [], sql: false, status: 1 },
  ];
  try {
    for (const scenario of scenarios) {
      writeFileSync(trace, ''); writeFileSync(sqlConfig, JSON.stringify(Object.hasOwn(scenario, 'value') ? scenario.value : valid));
      chmodSync(sqlConfig, scenario.mode ?? 0o600);
      const result = spawnSync(process.execPath, [bootstrap], { encoding: 'utf8', timeout: 15000,
        env: { ...process.env, QUALITY_TEST_TRACE: trace, QUALITY_TEST_ARGS: JSON.stringify(scenario.args), MIGRATION_SECRET_ARN: 'OBSOLETE_TEST_ONLY' } });
      assert.equal(result.status, scenario.status, result.stderr);
      const events = readFileSync(trace, 'utf8').trim().split('\n').filter(Boolean).map(value => JSON.parse(value));
      assert.deepEqual(events, scenario.sql ? [{ event: 'sql.connect', encrypt: true, trustServerCertificate: false, port: 1433 }, { event: 'sql.query' }, { event: 'sql.close' }] : []);
      assert.ok(!(result.stdout + result.stderr).includes('SENSITIVE_TEST_ONLY'));
      if (scenario.status === 0) assert.deepEqual(JSON.parse(result.stdout), { mode: 'dry-run', count: 0, mismatch: 0 });
    }
    assert.equal(readFileSync(output, 'utf8'), '');
    if (process.platform !== 'win32') assert.equal(statSync(output).mode & 0o077, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
