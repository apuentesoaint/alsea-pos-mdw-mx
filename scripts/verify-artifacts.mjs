import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

assert.equal(Number(process.versions.node.split('.')[0]), 24, 'Se requiere Node.js 24');
const root = resolve('.cache/artifact-check');
await mkdir(root, { recursive: true });
const packageDirectory = process.argv[2] ?? '.serverless';
const template = JSON.parse(await readFile(resolve(packageDirectory, 'cloudformation-template-update-stack.json'), 'utf8'));
const resourceNames = new Set(Object.keys(template.Resources));
const references = new Set([...resourceNames, ...Object.keys(template.Parameters ?? {}), 'AWS::AccountId', 'AWS::Region', 'AWS::Partition', 'AWS::StackName', 'AWS::StackId', 'AWS::URLSuffix', 'AWS::NotificationARNs', 'AWS::NoValue']);
function auditTemplate(value) {
  if (!value || typeof value !== 'object') return;
  if (value.Ref) assert.ok(references.has(value.Ref), `Ref desconocida: ${value.Ref}`);
  if (value['Fn::GetAtt']) assert.ok(resourceNames.has(Array.isArray(value['Fn::GetAtt']) ? value['Fn::GetAtt'][0] : value['Fn::GetAtt'].split('.')[0]), 'GetAtt desconocido');
  if (value['Fn::If']) assert.ok(Object.hasOwn(template.Conditions ?? {}, value['Fn::If'][0]), 'Condición desconocida');
  if (typeof value.Condition === 'string') assert.ok(Object.hasOwn(template.Conditions ?? {}, value.Condition), 'Condición de recurso desconocida');
  for (const child of Object.values(value)) if (child && typeof child === 'object') auditTemplate(child);
}
auditTemplate(template);
for (const resource of Object.values(template.Resources)) for (const dependency of typeof resource.DependsOn === 'string' ? [resource.DependsOn] : resource.DependsOn ?? []) assert.ok(resourceNames.has(dependency), `Dependencia desconocida: ${dependency}`);
const lambdas = Object.values(template.Resources).filter(value => value.Type === 'AWS::Lambda::Function');
assert.equal(lambdas.length, 6);
assert.ok(lambdas.every(value => value.Properties.Runtime === 'nodejs24.x'));
const stage = lambdas[0].Properties.Environment.Variables.STAGE;
const retention = { dev: 7, qa: 14, prod: 90 }[stage];
assert.ok(retention, 'Entorno permitido');
assert.equal(template.Resources.GatewayExecutionLogGroup.Properties.RetentionInDays, retention);
assert.ok(Object.values(template.Resources).filter(value => value.Type === 'AWS::Logs::LogGroup').every(value => value.Properties.RetentionInDays === retention));
for (const name of ['TransactionsTable', 'DetailsBucket', 'DetailsBucketPolicy', 'SecretsKey']) {
  assert.equal(template.Resources[name].DeletionPolicy, 'Retain');
  assert.equal(template.Resources[name].UpdateReplacePolicy, 'Retain');
}
assert.equal(template.Resources.TransactionsTable.Properties.BillingMode, 'PAY_PER_REQUEST');
assert.equal(template.Resources.TransactionsTable.Properties.PointInTimeRecoverySpecification.RecoveryPeriodInDays, 35);
assert.equal(template.Resources.TransactionsTable.Properties.TimeToLiveSpecification, undefined);
assert.equal(template.Resources.TransactionsTable.Properties.StreamSpecification, undefined);
for (const deployment of Object.values(template.Resources).filter(value => value.Type === 'AWS::ApiGateway::Deployment')) {
  assert.ok(deployment.DependsOn.includes('GatewayExecutionLogGroup'), 'Crear logs antes del stage');
}
assert.ok(!JSON.stringify(template).includes('dynamodb:TransactWriteItems'), 'Las transacciones autorizan acciones por elemento');
const packageFile = JSON.parse(await readFile('package.json', 'utf8'));
assert.equal(packageFile.type, 'module');
assert.equal(packageFile.devDependencies.serverless, '3.40.0');
assert.equal(packageFile.devDependencies['serverless-esbuild'], '1.57.2');
assert.equal(packageFile.devDependencies.esbuild, '0.28.2');
assert.ok(Object.entries(packageFile.dependencies).filter(([name]) => name.startsWith('@aws-sdk/')).every(([, version]) => version.startsWith('3.')));
assert.equal(packageFile.dependencies['aws-sdk'], undefined);
assert.equal(packageFile.dependencies['ts-node'], undefined);
assert.equal(packageFile.dependencies.tsx, undefined);
assert.ok((await readFile('src/runtime.ts', 'utf8')).includes('await compose()'));
async function auditSource(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) { await auditSource(path); continue; }
    if (!/\.(?:ts|mjs|js)$/.test(path)) continue;
    const source = await readFile(path, 'utf8');
    assert.match(source, /\b(?:import|export)\s/, `Código propio ESM: ${path}`);
    // Control léxico adicional al typecheck y a la carga real de los artefactos.
    assert.ok(!/\brequire\s*\(|\bmodule\s*\.\s*exports\b|\bexports\s*\./.test(source), `Sintaxis CommonJS: ${path}`);
    assert.ok(!/(?:from\s*|import\s*\(?)['"](?:aws-sdk|ts-node|tsx)(?:\/|['"])/.test(source), `Importación prohibida: ${path}`);
  }
}
for (const directory of ['src', 'scripts', 'plugins', 'infra', 'test']) await auditSource(directory);
function zipEntries(path) {
  const names = execFileSync('unzip', ['-Z1', path], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  return names.map(name => ({ name, data: execFileSync('unzip', ['-p', path, name], { maxBuffer: 50 * 1024 * 1024 }) }));
}
const filenames = (await readdir(packageDirectory)).filter(name => name.endsWith('.zip')).sort();
assert.deepEqual(filenames, ['auth', 'generate', 'latest', 'redeem', 'technical', 'validate'].map(name => `${name}.zip`), 'Deben existir los seis paquetes');
for (const filename of filenames) {
  const entries = await zipEntries(resolve(packageDirectory, filename));
  assert.ok(entries.every(entry => !/(?:^|\/)(?:aws-sdk|ts-node|tsx)(?:\/|$)|\.(?:ts|cjs)$/.test(entry.name)), `Contenido prohibido: ${filename}`);
  const main = entries.filter(entry => entry.name.endsWith('.mjs'));
  assert.equal(main.length, 1, `Un handler por artefacto: ${filename}`);
  assert.ok(entries.some(entry => entry.name === main[0].name.replace('.mjs', '-meta.json')), `Metafile del handler requerido: ${filename}`);
  for (const entry of entries) {
    assert.ok(!/AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(entry.data.toString('utf8')), `Contenido sensible: ${filename}`);
    if (entry.name.endsWith('-meta.json')) {
      const meta = JSON.parse(entry.data.toString('utf8'));
      assert.ok(Object.keys(meta.inputs).every(path => !/(?:^|\/)node_modules\/aws-sdk\//.test(path)), 'SDK v2 no permitido en Lambda');
    }
  }
  const destination = resolve(root, stage, filename.replace('.zip', ''));
  await rm(destination, { recursive: true, force: true });
  for (const entry of entries) {
    const path = resolve(destination, entry.name);
    assert.ok(path.startsWith(`${destination}/`));
    await mkdir(dirname(path), { recursive: true }); await writeFile(path, entry.data);
  }
  const module = await import(pathToFileURL(resolve(destination, main[0].name)).href);
  assert.equal(typeof module.handler, 'function', `Handler ESM: ${filename}`);
  const health = await module.handler({ httpMethod: 'GET', path: '/coupons/healthcheck', headers: {}, body: null });
  assert.equal(health.statusCode, 200); assert.equal(health.body, 'HealthCheck MS Admin Cupon OK');
  console.info(`${filename}: Node.js 24, ESM, top-level await y carga del handler comprobados`);
}
console.info('Artefactos y controles de infraestructura comprobados localmente; no se invocó AWS.');
