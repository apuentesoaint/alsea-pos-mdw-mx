import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const runner = resolve('scripts/lint-infrastructure.mjs');

test('el wrapper cfn-lint falla cerrado y descarta informes obsoletos', { skip: process.platform === 'win32' }, () => {
  const root = mkdtempSync(join(tmpdir(), 'quality tools '));
  const executable = join(root, '.cache/cfn-lint/bin/cfn-lint');
  const report = join(root, '.cache/quality/cfn-lint.json');
  const directory = join(root, 'package with spaces');
  mkdirSync(join(root, '.cache/cfn-lint/bin'), { recursive: true });
  mkdirSync(join(root, '.cache/quality'), { recursive: true });
  mkdirSync(directory);
  writeFileSync(join(directory, 'cloudformation-template-update-stack.json'), '{}');
  // Simula únicamente el protocolo del ejecutable; los esquemas se prueban con cfn-lint real fuera de este test.
  const fixture = `#!/usr/bin/env node
const mode = process.env.QUALITY_TEST_MODE;
if (process.argv.includes('--version')) { console.log(mode === 'version' ? 'cfn-lint 0.0.0' : 'cfn-lint 1.58.0'); process.exit(0); }
if (mode === 'signal') process.kill(process.pid, 'SIGTERM');
if (mode === 'json') { console.log('INVALID'); process.exit(0); }
if (mode === 'shape') { console.log('{}'); process.exit(0); }
if (mode === 'empty') process.exit(0);
const findings = ['error', 'warning', 'info', 'global'].includes(mode) ? [{Level: mode === 'info' ? 'Informational' : mode === 'warning' ? 'Warning' : 'Error', Rule: {Id: 'TEST'}, Message: 'Test fixture', Location: {Start: {LineNumber: 1}, Path: mode === 'global' ? null : ['Resources']}}] : [];
console.log(JSON.stringify(findings));
process.exit(mode === 'error' ? 2 : mode === 'exit' ? 1 : 0);
`;
  try {
    writeFileSync(executable, fixture); chmodSync(executable, 0o700);
    const run = (mode: string, packagePath = directory) => spawnSync(process.execPath, [runner, packagePath], {
      cwd: root, encoding: 'utf8', env: { ...process.env, QUALITY_TEST_MODE: mode }, timeout: 15000,
    });
    for (const mode of ['version', 'json', 'shape', 'empty', 'signal']) {
      writeFileSync(report, 'STALE');
      const result = run(mode);
      assert.equal(result.status, 1, `${mode}: ${result.stderr}`);
      assert.ok(!existsSync(report), mode);
    }
    for (const mode of ['error', 'exit', 'global']) assert.equal(run(mode).status, 1, mode);
    for (const mode of ['success', 'warning', 'info']) {
      const result = run(mode);
      assert.equal(result.status, 0, result.stderr);
      assert.ok(Array.isArray(JSON.parse(readFileSync(report, 'utf8'))));
      if (mode === 'warning') assert.match(result.stderr, /TEST: 1/);
    }
    assert.equal(run('success', join(root, 'missing-package')).status, 1);
    assert.ok(!existsSync(report));
    rmSync(executable);
    assert.equal(run('success').status, 1);
    assert.ok(!existsSync(report));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('ESLint detecta errores en scripts actuales y JavaScript propio fuera de scripts', () => {
  for (const file of ['scripts/quality-probe.mjs', 'src/quality-probe.js', 'quality-probe.mjs']) {
    const result = spawnSync(process.execPath, ['node_modules/eslint/bin/eslint.js', '--stdin', '--stdin-filename', file], {
      input: 'console.log(missingQualityVariable);\n', encoding: 'utf8', timeout: 15000,
    });
    assert.equal(result.status, 1, file);
    assert.match(result.stdout, /no-undef/);
  }
});
