import { readFile, stat } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { DescribeSecretCommand, PutSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

const { values } = parseArgs({ options: { arn: { type: 'string' }, file: { type: 'string' }, kind: { type: 'string' }, replace: { type: 'boolean', default: false } } });
const fields: Record<string, string[]> = { auth: ['clientId', 'clientSecret'], signing: ['keyBase64'], cuponera: ['basic'], starbucks: ['clientId', 'clientSecret'], sql: ['host', 'username', 'password', 'dbname'] };
async function main() {
  if (!values.arn || !values.file || !values.kind || !fields[values.kind]) throw new Error('Indicar --arn, --file y --kind auth|signing|cuponera|starbucks|sql');
  const metadata = await stat(values.file);
  if (process.platform !== 'win32' && (metadata.mode & 0o077) !== 0) throw new Error('El archivo debe tener permisos 600');
  const input = await readFile(values.file, 'utf8');
  const value: Record<string, unknown> = JSON.parse(input);
  if (fields[values.kind]!.some(field => typeof value[field] !== 'string' || !value[field])) throw new Error('Estructura de secreto incompleta');
  if (values.kind === 'signing' && Buffer.from(String(value.keyBase64), 'base64').byteLength < 48) throw new Error('La firma requiere al menos 48 bytes');
  const client = new SecretsManagerClient({ maxAttempts: 3 });
  const existing = await client.send(new DescribeSecretCommand({ SecretId: values.arn }));
  if (Object.values(existing.VersionIdsToStages ?? {}).some(stages => stages.includes('AWSCURRENT')) && !values.replace) throw new Error('El secreto ya tiene una versión; coordinar rotación antes de usar --replace');
  const result = await client.send(new PutSecretValueCommand({ SecretId: values.arn, SecretString: JSON.stringify(value), ClientRequestToken: randomUUID() }));
  console.info(JSON.stringify({ event: 'secret.version-created', versionId: result.VersionId }));
}
try { await main(); } catch { console.error('No se cargó el secreto. Revisar parámetros, permisos, estructura y existencia de una versión previa; ningún valor se registra.'); process.exitCode = 1; }
