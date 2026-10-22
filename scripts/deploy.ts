import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { devNull } from 'node:os';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import { APIGatewayClient, GetAccountCommand } from '@aws-sdk/client-api-gateway';
import { deploymentConfiguration, DeploymentConfigurationError } from './deployment-config.js';

const { values } = parseArgs({ options: { stage: { type: 'string', default: 'dev' }, config: { type: 'string' }, execute: { type: 'boolean', default: false } } });
async function main() {
  if (!['dev', 'qa', 'prod'].includes(values.stage!)) throw new Error('Stage inválido');
  if (!values.config) throw new Error('Indicar --config con configuración no sensible del entorno');
  const config = deploymentConfiguration(await readFile(values.config, 'utf8'));
  const parameters = config.parameters;
  const region = 'us-east-1';
  const identity = await new STSClient({ region }).send(new GetCallerIdentityCommand({}));
  if (identity.Account !== config.accountId) throw new DeploymentConfigurationError('La identidad AWS no pertenece a la cuenta esperada');
  const account = await new APIGatewayClient({ region }).send(new GetAccountCommand({}));
  // La configuración de logs es regional: conservar el rol existente de otros servicios.
  if (account.cloudwatchRoleArn) parameters.gatewayLogsRoleArn = account.cloudwatchRoleArn;
  const args = ['--stage', values.stage!, ...Object.entries(parameters).map(([key, value]) => `--param=${key}=${value}`)];
  const buildEnvironment = {
    ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('AWS_') && !['SLS_ACCESS_KEY', 'SERVERLESS_ACCESS_KEY'].includes(name))),
    AWS_CONFIG_FILE: devNull, AWS_SHARED_CREDENTIALS_FILE: devNull, AWS_EC2_METADATA_DISABLED: 'true',
  };
  const run = (script: string, extra: string[]) => {
    const preload = script === 'node_modules/serverless/bin/serverless.js' ? ['--import', './scripts/toolchain-compat.mjs'] : [];
    const environment = extra[0] === 'deploy' ? process.env : buildEnvironment;
    const child = spawnSync(process.execPath, [...preload, script, ...extra], { stdio: 'inherit', env: { ...environment, SLS_TELEMETRY_DISABLED: '1', SLS_DISABLE_AUTO_UPDATE: '1' } });
    if (child.status !== 0) throw new DeploymentConfigurationError('Falló la verificación o el comando de despliegue');
  };
  run('scripts/prepare-assets.mjs', []);
  run('node_modules/serverless/bin/serverless.js', ['package', ...args]);
  run('scripts/verify-artifacts.mjs', []);
  run('scripts/verify-runtime.mjs', []);
  run('scripts/artifact-integrity.mjs', ['record']);
  if (!values.execute) { console.info('Cuenta y configuración verificadas. Artefactos preparados; no se desplegó infraestructura.'); return; }
  run('scripts/audit-dependencies.mjs', []);
  run('scripts/artifact-integrity.mjs', ['check']);
  run('node_modules/serverless/bin/serverless.js', ['deploy', '--package', '.serverless', ...args]);
}
try { await main(); } catch (error) {
  // No mostrar objetos SDK ni contenido de archivos de configuración.
  console.error(error instanceof DeploymentConfigurationError ? error.message : 'Falló la comprobación AWS de identidad/configuración'); process.exitCode = 1;
}
