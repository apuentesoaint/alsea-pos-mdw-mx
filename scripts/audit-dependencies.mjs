import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('Se requiere Node.js 24');
await mkdir('.cache/security', { recursive: true });
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
  console.info(JSON.stringify({ audit: name, ...counts }));
  if (counts.total > 0) failed = true;
}
if (failed) {
  console.error('Aceptación de seguridad bloqueada: quedan avisos conocidos. Consultar .cache/security y docs/dependency-remediation.md.');
  process.exitCode = 1;
}
