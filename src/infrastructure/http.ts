import { requestContext, log, metric } from '../core/logging.js';
import { parseJson } from '../core/json.js';
import { STATUS_CODES } from 'node:http';

export class ExternalHttpError extends Error {
  constructor(readonly status: number, readonly text: string) {
    super(`${status} ${STATUS_CODES[status] ?? ''}: ${text ? `"${text}"` : '[no body]'}`);
    this.name = 'ExternalHttpError';
  }
}
export type HttpTransport = (url: string, init: RequestInit, provider: string, operation: string) => Promise<{ status: number; text: string }>;
export function transport(timeoutMs: number, fetcher: typeof fetch = fetch): HttpTransport {
  return async (url, init, provider, operation) => {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname))) throw new Error('La integración requiere HTTPS');
    const remaining = (requestContext.getStore()?.deadline ?? Date.now() + timeoutMs) - Date.now() - 200;
    if (remaining <= 0) throw new DOMException('Tiempo de integración agotado', 'TimeoutError');
    const headers = new Headers(init.headers);
    const transactionId = requestContext.getStore()?.transactionId;
    if (transactionId) headers.set('X-Transaction-ID', transactionId);
    const started = performance.now();
    log('info', 'external.started', { provider, operation });
    try {
      const response = await fetcher(url, { ...init, headers, signal: AbortSignal.timeout(Math.max(1, Math.min(timeoutMs, remaining))), redirect: 'manual' });
      const text = await response.text();
      log('info', 'external.completed', { provider, operation, status: response.status, durationMs: Math.round(performance.now() - started) });
      if (response.status >= 400) throw new ExternalHttpError(response.status, text);
      return { status: response.status, text };
    } catch (error) {
      metric('ExternalErrors'); log('error', 'external.failed', { provider, operation, errorType: error instanceof Error ? error.name : 'UnknownError', durationMs: Math.round(performance.now() - started) });
      throw error;
    }
  };
}
export function externalJson<T>(text: string): T { return parseJson(text) as T; }
