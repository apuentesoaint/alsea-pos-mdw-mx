export class DeploymentConfigurationError extends Error {}
export interface DeploymentConfiguration { accountId: string; parameters: Record<string, string> }
const urls = ['cuponeraTokenUrl', 'cuponeraValidateUrl', 'cuponeraRedeemUrl', 'cuponeraGenerateUrl', 'starbucksBaseUrl', 'openapiDevUrl', 'openapiProdUrl'];
const allowed = new Set([...urls, 'starbucksVersion', 'starbucksTokenPath', 'starbucksCouponPath', 'publicBasePath', 'securitySecretName', 'securitySecretKmsKeyArn']);
export function deploymentConfiguration(text: string): DeploymentConfiguration {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new DeploymentConfigurationError('El archivo de configuración no contiene JSON válido'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DeploymentConfigurationError('Configuración de despliegue inválida');
  const config = value as DeploymentConfiguration;
  if (typeof config.accountId !== 'string' || !/^\d{12}$/.test(config.accountId) || /^0+$/.test(config.accountId)) throw new DeploymentConfigurationError('Indicar la cuenta AWS real esperada');
  const parameters = config.parameters;
  if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters) || Object.entries(parameters).some(([key, value]) => !allowed.has(key) || typeof value !== 'string')) throw new DeploymentConfigurationError('Los parámetros deben ser cadenas no sensibles de configuración permitida');
  if (Object.values(parameters).some(value => value.includes('${') || value.includes('{{resolve:'))) throw new DeploymentConfigurationError('Los parámetros públicos deben contener valores literales, sin referencias dinámicas');
  if (Object.values(parameters).some(value => /REPLACE_ME/i.test(value))) throw new DeploymentConfigurationError('Sustituir todos los marcadores REPLACE_ME antes de desplegar');
  if (parameters.securitySecretName !== undefined && !/^[\w/+=.@-]{1,512}$/.test(parameters.securitySecretName)) throw new DeploymentConfigurationError('Nombre de secreto inválido');
  if (parameters.securitySecretKmsKeyArn && !/^arn:[a-z0-9-]+:kms:[a-z0-9-]+:[0-9]{12}:key\/[a-zA-Z0-9-]+$/.test(parameters.securitySecretKmsKeyArn)) throw new DeploymentConfigurationError('ARN KMS inválido');
  for (const name of urls) {
    try {
      const url = new URL(parameters[name]!);
      const localDocumentation = name === 'openapiDevUrl' && url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      if ((url.protocol !== 'https:' && !localDocumentation) || url.username || url.password || /(?:^|\.)invalid\.?$/.test(url.hostname)) throw new Error();
    } catch { throw new DeploymentConfigurationError(`URL no configurada: ${name}`); }
  }
  for (const name of ['starbucksTokenPath', 'starbucksCouponPath']) if (!/^\/(?!\/)/.test(parameters[name] ?? '')) throw new DeploymentConfigurationError(`Ruta no configurada: ${name}`);
  if (parameters.starbucksVersion && !/^\/(?!\/)/.test(parameters.starbucksVersion)) throw new DeploymentConfigurationError('Versión Starbucks inválida');
  if (parameters.publicBasePath && (!/^\/(?!\/)/.test(parameters.publicBasePath) || /[?#\r\n]/.test(parameters.publicBasePath))) throw new DeploymentConfigurationError('Prefijo público inválido');
  return config;
}
