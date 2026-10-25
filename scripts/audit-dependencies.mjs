import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

// Avisos aceptados de forma explícita y acotada. Solo aplican al árbol completo
// (herramientas de desarrollo); producción sigue exigiendo cero avisos.
// GHSA-j965-2qgj-vjmq: aws-sdk v2 transitivo de Serverless 3.40.0. Corregirlo exige
// Serverless 4 (licencia de pago), descartado por el proyecto. Severidad baja; el
// aws-sdk v2 no se incluye en los ZIP Lambda (que usan SDK v3).
// GHSA-xcx6-jx8p-x3h5: @azure/msal-node transitivo devDependency.
const ACCEPTED = new Map([
  ['GHSA-j965-2qgj-vjmq', { severity: 'low', packages: ['aws-sdk', 'serverless'] }],
  ['GHSA-xcx6-jx8p-x3h5', { severity: 'high', packages: ['@azure/msal-node', '@azure/identity'] }],
]);

if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('Se requiere Node.js 24');
await mkdir('.cache/security', { recursive: true });

/** Un paquete es aceptable si todas sus causas son avisos aceptados o paquetes aceptables. */
function unacceptedPackages(report) {
  const vulnerabilities = report.vulnerabilities ?? {};
  const memo = new Map();
  const accepted = (name, seen = new Set()) => {
    if (memo.has(name)) return memo.get(name);
    if (seen.has(name)) return false;
    seen.add(name);
    const entry = vulnerabilities[name];
    let ok = Boolean(entry) && Array.isArray(entry.via) && entry.via.length > 0 && entry.via.every(cause => {
      if (typeof cause === 'string') return accepted(cause, seen);
      const id = String(cause?.url ?? '').split('/').pop();
      const rule = ACCEPTED.get(id);
      return Boolean(rule) && cause.severity === rule.severity && rule.packages.includes(name);
    });
    if (ok) ok = [...ACCEPTED.values()].some(rule => rule.packages.includes(name) && entry.severity === rule.severity);
    memo.set(name, ok);
    return ok;
  };
  return Object.keys(vulnerabilities).filter(name => !accepted(name));
}

let failed = false;
for (const [name, flags] of [['all', []], ['production', ['--omit=dev']]]) {
  let output;
  try { output = execFileSync('npm', ['audit', '--json', ...flags], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (error) { output = error.stdout; }
  let report;
  try { report = JSON.parse(output); } catch { throw new Error('No se obtuvo un informe de auditoría válido; no se aprueba seguridad'); }
  if (report.error || !report.metadata?.vulnerabilities) throw new Error('La auditoría no pudo completarse; no se aprueba seguridad');
  await writeFile(`.cache/security/${name}.json`, JSON.stringify(report, null, 2) + '\n');
  const counts = report.metadata.vulnerabilities;
  const pending = name === 'production' ? Object.keys(report.vulnerabilities ?? {}) : unacceptedPackages(report);
  console.info(JSON.stringify({ audit: name, ...counts, accepted: counts.total - pending.length, pending }));
  if (name === 'production' && counts.total > 0) failed = true;
  if (pending.length > 0) failed = true;
}
if (failed) {
  console.error('Aceptación de seguridad bloqueada: quedan avisos no aceptados. Consultar .cache/security y docs/dependency-remediation.md.');
  process.exitCode = 1;
}
