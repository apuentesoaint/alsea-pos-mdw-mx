import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

function run(code: string) {
  const result = spawnSync(process.execPath, ['--import', './scripts/toolchain-compat.mjs', '--input-type=module', '-e', code], {
    encoding: 'utf8', timeout: 30_000, env: { ...process.env, SLS_TELEMETRY_DISABLED: '1', SLS_DISABLE_AUTO_UPDATE: '1' },
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
}
test('el consumidor Git de Serverless carga la interfaz corregida en Node 24', () => {
  run(`import assert from 'node:assert/strict';
    const { default: parse } = await import('./node_modules/@serverless/dashboard-plugin/lib/deployment/parse.js');
    assert.equal(typeof parse, 'function');
    const { simpleGit } = await import('simple-git');
    assert.equal(typeof simpleGit().checkIsRepo, 'function');`);
});
test('el adaptador falla cerrado si cambia el hash de un consumidor', () => {
  run(`import assert from 'node:assert/strict';
    import { readFile } from 'node:fs/promises';
    import { pathToFileURL } from 'node:url';
    import { adaptThirdPartySource } from './scripts/toolchain-compat.mjs';
    const path = './node_modules/@serverless/utils/download.js';
    const url = pathToFileURL(path).href; const source = await readFile(path, 'utf8');
    assert.notEqual(adaptThirdPartySource(url, source), source);
    assert.throws(() => adaptThirdPartySource(url, source + ' '), /Cambió un consumidor/);
    assert.equal(adaptThirdPartySource('file:///unrelated.js', source), source);`);
});
test('download de Serverless extrae ZIP y TGZ locales con bibliotecas corregidas', () => {
  run(`import assert from 'node:assert/strict';
    import { createServer } from 'node:http';
    import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
    import { tmpdir } from 'node:os'; import { join } from 'node:path';
    import AdmZip from 'adm-zip'; import { c as tarCreate } from 'tar';
    import download from '@serverless/utils/download.js';
    const scratch = await mkdtemp(join(tmpdir(), 'cuponera-tools-')); let server;
    try {
      const input = join(scratch, 'input'); await mkdir(input); await writeFile(join(input, 'ok.txt'), 'verified');
      await tarCreate({ cwd: input, gzip: true, file: join(scratch, 'input.tgz') }, ['ok.txt']);
      const zip = new AdmZip(); zip.addFile('ok.txt', Buffer.from('verified'));
      const archives = { '/zip': zip.toBuffer(), '/tgz': await readFile(join(scratch, 'input.tgz')) };
      server = createServer((req, res) => { res.setHeader('Content-Type', 'application/octet-stream'); res.end(archives[req.url]); });
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port;
      for (const kind of ['zip', 'tgz']) {
        const output = join(scratch, kind); await download('http://127.0.0.1:' + port + '/' + kind, output, { extract: true });
        assert.equal(await readFile(join(output, 'ok.txt'), 'utf8'), 'verified');
      }
    } finally { if (server) await new Promise(resolve => server.close(resolve)); await rm(scratch, { recursive: true, force: true }); }`);
});
test('la extracción no escribe fuera del destino con traversal y enlaces', () => {
  run(`import assert from 'node:assert/strict';
    import { createServer } from 'node:http'; import { gzipSync } from 'node:zlib';
    import { mkdtemp, readFile, rm } from 'node:fs/promises'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
    import download from '@serverless/utils/download.js';
    function member(name, type = '0', link = '') {
      const h = Buffer.alloc(512); h.write(name); h.write('0000644\\0', 100); h.write('0000000\\0', 108); h.write('0000000\\0', 116);
      h.write('00000000000\\0', 124); h.write('00000000000\\0', 136); h.fill(32, 148, 156); h.write(type, 156); h.write(link, 157);
      h.write('ustar\\0', 257); h.write('00', 263);
      h.write([...h].reduce((sum, byte) => sum + byte, 0).toString(8).padStart(6, '0') + '\\0 ', 148);
      return h;
    }
    const archives = [gzipSync(Buffer.concat([member('../escape.txt'), Buffer.alloc(1024)])),
      gzipSync(Buffer.concat([member('bridge', '2', '..'), member('bridge/escape.txt'), Buffer.alloc(1024)])),
      gzipSync(Buffer.concat([member('ok.txt'), Buffer.alloc(1024)]))];
    const scratch = await mkdtemp(join(tmpdir(), 'cuponera-unsafe-')); let server;
    try {
      server = createServer((req, res) => res.end(archives[Number(req.url.slice(1))]));
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port;
      const positive = join(scratch, 'positive'); await download('http://127.0.0.1:' + port + '/2', positive, { extract: true });
      assert.equal((await readFile(join(positive, 'ok.txt'))).length, 0);
      for (let index = 0; index < 2; index++) {
        try { await download('http://127.0.0.1:' + port + '/' + index, join(scratch, 'out-' + index), { extract: true }); } catch {}
        await assert.rejects(readFile(join(scratch, 'escape.txt')), error => error.code === 'ENOENT');
      }
    } finally { if (server) await new Promise(resolve => server.close(resolve)); await rm(scratch, { recursive: true, force: true }); }`);
});
test('el manifiesto detecta modificación de ZIP, adición y eliminación de archivos', () => {
  run(`import assert from 'node:assert/strict'; import { mkdtemp, writeFile, rm } from 'node:fs/promises';
    import { join } from 'node:path'; import { tmpdir } from 'node:os';
    import { artifactIntegrity } from './scripts/artifact-integrity.mjs';
    const scratch = await mkdtemp(join(tmpdir(), 'cuponera-integrity-'));
    try {
      for (let i = 0; i < 6; i++) await writeFile(join(scratch, i + '.zip'), 'fixture');
      await artifactIntegrity('record', scratch); await artifactIntegrity('check', scratch);
      await writeFile(join(scratch, '0.zip'), 'modified'); await assert.rejects(artifactIntegrity('check', scratch), /Cambió el artefacto/);
      await writeFile(join(scratch, '0.zip'), 'fixture'); await writeFile(join(scratch, 'extra'), 'extra');
      await assert.rejects(artifactIntegrity('check', scratch), /Cambió el artefacto/); await rm(join(scratch, 'extra'));
      await rm(join(scratch, '0.zip')); await assert.rejects(artifactIntegrity('check', scratch), /Cambió el artefacto/);
    } finally { await rm(scratch, { recursive: true, force: true }); }`);
});
