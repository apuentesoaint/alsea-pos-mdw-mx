import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const digest = value => createHash('sha256').update(value).digest('hex');
async function inventory(directory, relative = '') {
  const result = {};
  for (const entry of await readdir(join(directory, relative), { withFileTypes: true })) {
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    if (name === 'artifact-integrity.json') continue;
    if (entry.isDirectory()) Object.assign(result, await inventory(directory, name));
    else if (entry.isFile()) result[name] = digest(await readFile(join(directory, name)));
    else throw new Error('Tipo de archivo no permitido en artefactos');
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}
export async function artifactIntegrity(mode, directory = '.serverless') {
  const path = join(directory, 'artifact-integrity.json');
  const actual = { algorithm: 'sha256', lockfile: digest(await readFile('package-lock.json')), files: await inventory(directory) };
  if (mode === 'record') {
    if (Object.keys(actual.files).filter(name => name.endsWith('.zip')).length !== 6) throw new Error('Se requieren los seis ZIP verificados');
    await writeFile(path, JSON.stringify(actual, null, 2) + '\n');
  } else if (mode === 'check') {
    const expected = JSON.parse(await readFile(path, 'utf8'));
    if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error('Cambió el artefacto o lockfile después de verificarlo');
  } else throw new Error('Modo de integridad inválido');
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('Se requiere Node.js 24');
  await artifactIntegrity(process.argv[2], process.argv[3]);
  console.info('Integridad SHA-256 del artefacto comprobada/registrada; no certifica origen ni sustituye la auditoría.');
}
