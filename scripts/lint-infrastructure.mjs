import { spawnSync } from 'node:child_process';
import { accessSync, constants, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const executable = resolve('.cache/cfn-lint', process.platform === 'win32' ? 'Scripts/cfn-lint.exe' : 'bin/cfn-lint');
const template = resolve(process.argv[2] ?? '.serverless', 'cloudformation-template-update-stack.json');
const report = resolve('.cache/quality/cfn-lint.json');
// Un fallo de preparación no debe conservar como vigente un informe anterior.
rmSync(report, { force: true });

try {
  accessSync(executable, constants.X_OK);
  accessSync(template, constants.R_OK);
} catch {
  console.error('Se requiere cfn-lint local y una plantilla empaquetada. Ejecutar npm run setup:infra-lint y npm run package.');
  process.exit(1);
}

const version = spawnSync(executable, ['--version'], { encoding: 'utf8', timeout: 10000 });
if (version.status !== 0 || version.stdout.trim() !== 'cfn-lint 1.58.0') {
  console.error('Se requiere cfn-lint 1.58.0. Ejecutar npm run setup:infra-lint.');
  process.exit(1);
}
const result = spawnSync(executable, ['--format', 'json', '--regions', 'us-east-1', '--non-zero-exit-code', 'error', '--template', template], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, timeout: 120000 });
if (result.error || !result.stdout.trim()) {
  console.error('No se pudo obtener un informe de cfn-lint.', result.stderr ?? '');
  process.exit(1);
}
let findings;
try {
  findings = JSON.parse(result.stdout);
  if (!Array.isArray(findings) || !findings.every(finding =>
    finding && ['Error', 'Warning', 'Informational'].includes(finding.Level) &&
    typeof finding.Rule?.Id === 'string' && typeof finding.Message === 'string' &&
    Number.isInteger(finding.Location?.Start?.LineNumber) &&
    (Array.isArray(finding.Location?.Path) || finding.Location?.Path === null)
  )) throw new Error('Estructura inesperada');
} catch {
  console.error('cfn-lint no devolvió un informe JSON válido; la validación no se aprueba.');
  process.exit(1);
}
mkdirSync('.cache/quality', { recursive: true });
writeFileSync(report, result.stdout);
const counts = level => findings.filter(finding => finding.Level === level).length;
console.info(`cfn-lint: ${counts('Error')} errores, ${counts('Warning')} advertencias, ${counts('Informational')} informativos.`);
for (const finding of findings.filter(finding => finding.Level === 'Error')) {
  console.error(`${finding.Rule.Id} línea ${finding.Location.Start.LineNumber} ${(finding.Location.Path ?? []).join('/')}: ${finding.Message}`);
}
for (const rule of new Set(findings.filter(finding => finding.Level === 'Warning').map(finding => finding.Rule.Id))) {
  console.warn(`${rule}: ${findings.filter(finding => finding.Rule.Id === rule).length} advertencias; consultar .cache/quality/cfn-lint.json`);
}
// No se ocultan advertencias; los errores de esquema y los fallos de ejecución bloquean verify.
process.exitCode = counts('Error') > 0 || result.status !== 0 ? 1 : 0;
if (result.status !== 0 && counts('Error') === 0) console.error('cfn-lint terminó con fallo aunque el informe no incluye errores.');
