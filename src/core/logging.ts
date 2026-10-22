import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export interface LogContext { transactionId: string; requestId: string; route: string; deadline?: number }
export const requestContext = new AsyncLocalStorage<LogContext>();
const allowed = new Set(['operation', 'provider', 'attempt', 'durationMs', 'status', 'errorType', 'kind', 'state', 'count', 'retryable', 'coldStart']);
/** Lista permitida: nunca serializa solicitudes, respuestas, credenciales ni mensajes de proveedores. */
export function log(level: 'info' | 'warn' | 'error', event: string, fields: Record<string, unknown> = {}): void {
  const priorities: Record<string, number> = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
  if (priorities[level.toUpperCase()]! < (priorities[process.env.LOG_LEVEL ?? 'INFO'] ?? 1)) return;
  const safe = Object.fromEntries(Object.entries(fields).filter(([key, value]) => allowed.has(key) && ['string', 'number', 'boolean'].includes(typeof value)));
  console[level](JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...requestContext.getStore(), ...safe }));
}
export function logError(error: unknown, operation: string): void {
  const errorType = error instanceof Error ? error.name : 'UnknownError';
  // Solo ubicaciones del stack; no se copia la primera línea, que puede contener secretos.
  const frames = error instanceof Error ? error.stack?.split('\n').slice(1).filter(line => /^\s+at [\w.$<> /:@()-]+$/.test(line)).slice(0, 8) : [];
  log('error', 'operation.failed', { operation, errorType });
  if (frames?.length) console.error(JSON.stringify({ level: 'error', event: 'error.frames', ...requestContext.getStore(), frames }));
  if (error instanceof Error && error.cause instanceof Error) log('error', 'operation.cause', { operation, errorType: error.cause.name });
}
export function metric(name: string, value = 1, unit = 'Count'): void {
  console.info(JSON.stringify({
    _aws: { Timestamp: Date.now(), CloudWatchMetrics: [{ Namespace: 'Cuponera', Dimensions: [['Stage']], Metrics: [{ Name: name, Unit: unit }] }] },
    Stage: process.env.STAGE ?? 'dev', [name]: value,
  }));
}
export function correlation(value?: string | null): string {
  // Neutraliza saltos de línea y limita el identificador usado en logs/cabeceras.
  return value?.replace(/[\r\n\x00-\x1f\x7f]/g, '').slice(0, 128) || randomUUID();
}
