import { requestContext } from './logging.js';

/** El plazo cubre todos los intentos del SDK y deja margen para responder al gateway. */
export function awsSignal(): AbortSignal {
  const configured = Number(process.env.AWS_TIMEOUT_MS ?? 5000);
  if (!Number.isSafeInteger(configured) || configured <= 0 || configured > 25_000) throw new Error('Configuración inválida: AWS_TIMEOUT_MS');
  const remaining = (requestContext.getStore()?.deadline ?? Date.now() + configured + 500) - Date.now() - 500;
  return remaining <= 0 ? AbortSignal.abort() : AbortSignal.timeout(Math.max(1, Math.min(configured, remaining)));
}
