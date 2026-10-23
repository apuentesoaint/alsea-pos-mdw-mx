import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { DescribeSecretCommand, PutSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { readPrivateJson } from './private-json.js';
import { validateSecretPayload } from './secret-payload.js';

const { values } = parseArgs({ options: { id: { type: 'string' }, file: { type: 'string' }, replace: { type: 'boolean', default: false } } });
async function main() {
  if (!values.id || !values.file) throw new Error('Indicar --id del secreto único y --file con el JSON completo');
  const value = await readPrivateJson(values.file);
  validateSecretPayload(value);
  const client = new SecretsManagerClient({ maxAttempts: 3 });
  const existing = await client.send(new DescribeSecretCommand({ SecretId: values.id }));
  if (Object.values(existing.VersionIdsToStages ?? {}).some(stages => stages.includes('AWSCURRENT')) && !values.replace) throw new Error('El secreto ya tiene una versión; coordinar rotación antes de usar --replace');
  const result = await client.send(new PutSecretValueCommand({ SecretId: values.id, SecretString: JSON.stringify(value), ClientRequestToken: randomUUID() }));
  console.info(JSON.stringify({ event: 'secret.version-created', versionId: result.VersionId }));
}
try { await main(); } catch { console.error('No se cargó el secreto. Revisar parámetros, permisos, estructura y existencia de una versión previa; ningún valor se registra.'); process.exitCode = 1; }
