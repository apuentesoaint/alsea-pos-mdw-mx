import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: { source: { type: 'string' }, output: { type: 'string', default: 'docs/source-baseline.json' } } });
if (!values.source) throw new Error('Indicar --source con la carpeta Cuponera; este comando no ejecuta Java');
const source = resolve(values.source);
const files = [];
async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['.git', 'target', '.github', '.mvn'].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await visit(path);
    else if (/\.(java|xml|ya?ml|properties)$/.test(entry.name)) {
      const bytes = await readFile(path);
      const text = bytes.toString('utf8');
      files.push({ path: relative(source, path), sha256: createHash('sha256').update(bytes).digest('hex'),
        environmentReferences: [...new Set([...text.matchAll(/\$\{([A-Z][A-Z0-9_]+)\}/g)].map(match => match[1]))],
        sensitiveLocations: text.split(/\r?\n/).flatMap((line, index) => /SECRET_KEY\s*=|AKIA[A-Z0-9]{16}|<password>|#(?:password|basic|clientSecret):/.test(line) ? [index + 1] : []),
      });
    }
  }
}
await visit(source);
const output = values.output;
await mkdir(resolve(output, '..'), { recursive: true });
await writeFile(output, `${JSON.stringify({ analysis: 'static-only', javaExecuted: false, files: files.sort((a, b) => a.path.localeCompare(b.path)) }, null, 2)}\n`);
console.info(JSON.stringify({ files: files.length, output, javaExecuted: false }));
