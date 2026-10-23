import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readPrivateJson } from '../scripts/private-json.js';

test('el lector privado acepta JSON UTF-8, rechaza permisos abiertos y sanea errores', async () => {
  const root = await mkdtemp(join(tmpdir(), 'private json '));
  const file = join(root, 'SENSITIVE_TEST_ONLY.json');
  const safe = (error: unknown) => error instanceof Error && !error.message.includes('SENSITIVE_TEST_ONLY') && error.cause === undefined;
  try {
    await writeFile(file, '{"value":"TEST_ONLY_á"}', { mode: 0o600 });
    assert.deepEqual(await readPrivateJson(file), { value: 'TEST_ONLY_á' });
    if (process.platform !== 'win32') {
      await chmod(file, 0o400);
      assert.deepEqual(await readPrivateJson(file), { value: 'TEST_ONLY_á' });
      await chmod(file, 0o644);
      await assert.rejects(readPrivateJson(file), safe);
      await chmod(file, 0o600);
    }
    await writeFile(file, '{"SENSITIVE_TEST_ONLY":');
    await assert.rejects(readPrivateJson(file), safe);
    await assert.rejects(readPrivateJson(join(root, 'SENSITIVE_TEST_ONLY_missing')), safe);
    const directory = join(root, 'directory'); await mkdir(directory, { mode: 0o700 });
    await assert.rejects(readPrivateJson(directory), safe);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('el lector privado rechaza FIFO sin bloquearse ni esperar un escritor', { skip: process.platform === 'win32', timeout: 5000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'private fifo '));
  try {
    const file = join(root, 'payload');
    const result = spawnSync('mkfifo', ['-m', '600', file], { encoding: 'utf8', timeout: 2000 });
    assert.equal(result.status, 0, result.stderr);
    await assert.rejects(readPrivateJson(file), /JSON privado/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
