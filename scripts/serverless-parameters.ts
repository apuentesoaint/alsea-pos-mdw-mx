import { randomUUID } from 'node:crypto';
import { open, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'yaml';

/** Serverless 3 rechaza --param=key=; conserva los vacíos mediante --config nativo. */
export async function withServerlessParameters<T>(stage: string, parameters: Record<string, string>, run: (args: string[]) => Promise<T>): Promise<T> {
  if (!Object.values(parameters).includes('')) return run(['--stage', stage, ...Object.entries(parameters).map(([key, value]) => `--param=${key}=${value}`)]);
  const configuration = parse(await readFile('serverless.yml', 'utf8'));
  configuration.params[stage] = { ...configuration.params[stage], ...parameters };
  // El framework exige --config en la raíz para conservar sus rutas relativas.
  // Solo contiene configuración pública ya validada; nunca versiones de secretos.
  const path = resolve(`.serverless-parameters-${randomUUID()}.json`);
  const file = await open(path, 'wx', 0o600);
  try {
    await file.writeFile(JSON.stringify(configuration));
    return await run(['--stage', stage, '--config', path]);
  } finally {
    try { await file.close(); } finally { await rm(path, { force: true }); }
  }
}
