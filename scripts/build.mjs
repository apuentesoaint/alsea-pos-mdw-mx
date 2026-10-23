import { build } from 'esbuild';
import { readdir, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import './prepare-assets.mjs';

if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('Se requiere Node.js 24');
async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(path));
    else if (path.endsWith('.ts')) result.push(path);
  }
  return result;
}
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await build({
  entryPoints: [...await files('src/handlers'), ...await files('scripts'), ...await files('test')],
  outdir: 'dist', outbase: '.', bundle: true, packages: 'external',
  platform: 'node', target: 'node24', format: 'esm', outExtension: { '.js': '.mjs' },
  sourcemap: true, sourcesContent: false,
});
