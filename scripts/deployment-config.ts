export class DeploymentConfigurationError extends Error {}
export interface DeploymentConfiguration { accountId: string; parameters: Record<string, string> }
const urls = ['cuponeraTokenUrl', 'cuponeraValidateUrl', 'cuponeraRedeemUrl', 'cuponeraGenerateUrl', 'starbucksBaseUrl', 'openapiDevUrl', 'openapiProdUrl'];
const allowed = new Set([...urls, 'starbucksVersion', 'starbucksTokenPath', 'starbucksCouponPath', 'publicBasePath']);
export function deploymentConfiguration(text: string): DeploymentConfiguration {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new DeploymentConfigurationError('El archivo de configuración no contiene JSON válido'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DeploymentConfigurationError('Configuración de despliegue inválida');
  const config = value as DeploymentConfiguration;
  if (typeof config.accountId !== 'string' || !/^\d{12}$/.test(config.accountId) || /^0+$/.test(config.accountId)) throw new DeploymentConfigurationError('Indicar la cuenta AWS real esperada');
  const parameters = config.parameters;
  if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters) || Object.entries(parameters).some(([key, value]) => !allowed.has(key) || typeof value !== 'string')) throw new DeploymentConfigurationError('Los parámetros deben ser cadenas no sensibles de configuración permitida');
  for (const name of urls) {
    try {
      const url = new URL(parameters[name]!);
      if (url.protocol !== 'https:' || url.username || url.password || url.hostname.endsWith('.invalid')) throw new Error();
    } catch { throw new DeploymentConfigurationError(`URL no configurada: ${name}`); }
  }
  for (const name of ['starbucksTokenPath', 'starbucksCouponPath']) if (!/^\/(?!\/)/.test(parameters[name] ?? '')) throw new DeploymentConfigurationError(`Ruta no configurada: ${name}`);
  if (parameters.starbucksVersion && !/^\/(?!\/)/.test(parameters.starbucksVersion)) throw new DeploymentConfigurationError('Versión Starbucks inválida');
  if (parameters.publicBasePath && (!/^\/(?!\/)/.test(parameters.publicBasePath) || /[?#\r\n]/.test(parameters.publicBasePath))) throw new DeploymentConfigurationError('Prefijo público inválido');
  return config;
}
