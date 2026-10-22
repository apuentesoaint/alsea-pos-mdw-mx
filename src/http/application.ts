import { randomUUID } from 'node:crypto';
import { AppError, publicError, technical } from '../core/errors.js';
import { stringify } from '../core/json.js';
import { correlation, log, logError, metric, requestContext } from '../core/logging.js';
import { body, generateBody, springInteger, redeemBody, validateBody } from '../core/validation.js';
import type { Authentication } from '../domain/auth.js';
import type { Coupons } from '../domain/coupons.js';
import { documentation } from './documentation.js';
import { HttpProblem, problemResponse } from './problems.js';
import { jsonTypes, negotiate, parseAccept, requestHeaders, utf8Representation } from './negotiation.js';

export interface HttpEvent { httpMethod: string; path: string; body: string | null; isBase64Encoded?: boolean;
  headers: Record<string, string | undefined>; queryStringParameters?: Record<string, string | undefined> | null;
  multiValueHeaders?: Record<string, string[] | undefined> | null;
  requestContext?: { requestId?: string; domainName?: string; stage?: string } }
export interface HttpResponse { statusCode: number; headers: Record<string, string>; body: string; isBase64Encoded?: boolean }
export interface Invocation { awsRequestId?: string; getRemainingTimeInMillis?: () => number }
const routes = new Map([
  ['/auth/token', 'POST'], ['/coupons/healthcheck', 'GET'], ['/coupons/validate', 'POST'], ['/coupons/redeem', 'POST'],
  ['/coupons/generate', 'POST'], ['/coupons/transaction/latest', 'GET'], ['/test-insights', 'GET'],
]);
// Valores predeterminados de Spring Security conservados también en errores y rutas públicas.
const securityHeaders = { 'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate', Pragma: 'no-cache', Expires: '0',
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'X-XSS-Protection': '0' };
const docPath = (path: string) => path === '/swagger-ui.html' || path === '/swagger-ui' || path.startsWith('/swagger-ui/')
  || path === '/v3/api-docs' || path.startsWith('/v3/api-docs/') || path.startsWith('/webjars/')
  || path === '/webjars' || path === '/v2/api-docs' || path.startsWith('/v2/api-docs/')
  || path === '/swagger-resources' || path.startsWith('/swagger-resources/') || ['/configuration/ui', '/configuration/security'].includes(path);
function response(statusCode: number, value: unknown, headers: Record<string, string> = {}): HttpResponse {
  return { statusCode, headers: { 'Content-Type': 'application/json', ...headers }, body: stringify(value) };
}
function envelope(status: number, path: string, uid: string | null, message: string, data: unknown, success = true) {
  return { uid, timestamp: new Date().toISOString().slice(0, -1) + '0', status, type: success ? 'success' : 'error', message, helpUrl: path, success, data };
}
function frameworkError(status: number, error: string, path: string): HttpResponse {
  return problemResponse(new HttpProblem(status, error, status === 404 ? `No static resource ${path.replace(/^\//, '')}.` : `Method is not supported.`), path);
}
export function createApplication(auth: Pick<Authentication, 'issue' | 'valid'>, coupons: Coupons) {
  return async (event: HttpEvent, invocation: Invocation = {}): Promise<HttpResponse> => {
    const headers = requestHeaders(event.headers ?? {}, event.multiValueHeaders);
    const transactionId = correlation(headers['x-transaction-id']);
    const path = event.path;
    const controllerHeaders: Record<string, string> = path.startsWith('/actuator/') || path === '/coupons/healthcheck' ? {} : { 'X-Transaction-ID': transactionId };
    const context = { transactionId, requestId: invocation.awsRequestId ?? event.requestContext?.requestId ?? randomUUID(), route: `${event.httpMethod} ${path}`,
      deadline: Date.now() + Math.min(invocation.getRemainingTimeInMillis?.() ?? 28_000, 28_000) };
    return requestContext.run(context, async () => {
      const representation = (selected: string) => {
        const result = utf8Representation(selected);
        if (result.pendingCharset) { metric('HttpParityGaps'); log('warn', 'http.charset-not-certified', { operation: 'negotiation' }); }
        return result.contentType;
      };
      const started = performance.now();
      log('info', 'request.started');
      let result: HttpResponse;
      try {
        const publicRoute = (path === '/auth/token' && event.httpMethod === 'POST') || (path === '/coupons/healthcheck' && event.httpMethod === 'GET') || docPath(path);
        if (!publicRoute && !await auth.valid(headers.authorization)) {
          result = { statusCode: 401, headers: { 'WWW-Authenticate': 'Basic realm="Realm"' }, body: '' };
        } else if (event.httpMethod === 'OPTIONS' && routes.has(path)) {
          result = { statusCode: 200, headers: { Allow: routes.get(path) === 'GET' ? 'GET,HEAD,OPTIONS' : 'POST,OPTIONS', ...controllerHeaders }, body: '' };
        } else if (docPath(path) || path === '/v3/api-docs.yaml') {
          if (['GET', 'HEAD'].includes(event.httpMethod) && ['/v3/api-docs', '/v3/api-docs/swagger-config', '/v3/api-docs.yaml'].includes(path)) {
            negotiate(headers.accept, [path.endsWith('.yaml') ? 'application/vnd.oai.openapi' : 'application/json']);
          }
          result = event.httpMethod === 'OPTIONS' ? { statusCode: 200, headers: { Allow: 'GET,HEAD,OPTIONS' }, body: '' }
            : ['GET', 'HEAD'].includes(event.httpMethod) ? await documentation(event) : frameworkError(405, 'Method Not Allowed', path);
          Object.assign(result.headers, controllerHeaders);
        } else if (routes.has(path) && routes.get(path) !== event.httpMethod && !(event.httpMethod === 'HEAD' && routes.get(path) === 'GET')) {
          result = problemResponse(new HttpProblem(405, 'Method Not Allowed', `Method '${event.httpMethod}' is not supported.`, { Allow: routes.get(path) === 'GET' ? 'GET,HEAD' : routes.get(path)! }), path);
        } else if (path === '/coupons/healthcheck') {
          // produces=application/json se comprueba en el mapping, antes del controlador.
          const selected = negotiate(headers.accept, ['application/json']);
          result = { statusCode: 200, headers: { 'Content-Type': representation(selected) }, body: 'HealthCheck MS Admin Cupon OK' };
        } else if (path === '/auth/token') {
          assertJsonMediaType(event, headers['content-type']);
          const request = body<{ clientId: string; clientSecret: string }>('auth', event.body, event.isBase64Encoded);
          const token = await auth.issue(request.clientId, request.clientSecret);
          result = token ? response(200, token) : { statusCode: 401, headers: {}, body: '' };
          Object.assign(result.headers, controllerHeaders);
        } else if (path === '/test-insights') {
          metric('TestEvent'); log('info', 'TestEvent', { operation: 'test-insights' });
          result = { statusCode: 200, headers: { 'Content-Type': 'text/plain;charset=UTF-8', ...controllerHeaders }, body: 'Evento de prueba enviado a Application Insights' };
        } else if (path.startsWith('/coupons/') && routes.has(path)) {
          try {
            if (event.httpMethod === 'POST') assertJsonMediaType(event, headers['content-type']);
            const output = path === '/coupons/validate' ? await coupons.validate(validateBody(event.body, event.isBase64Encoded))
              : path === '/coupons/redeem' ? await coupons.redeem(redeemBody(event.body, event.isBase64Encoded))
              : path === '/coupons/generate' ? await coupons.generate(generateBody(event.body, event.isBase64Encoded))
              : await (async () => {
                const query = event.queryStringParameters ?? {};
                for (const name of ['countryId', 'brandId', 'storeId', 'couponCode']) if (query[name] == null) throw new HttpProblem(400, 'Bad Request', `Required parameter '${name}' is not present.`);
                const integer = (name: string) => { try { return springInteger(query[name]); } catch { throw new HttpProblem(400, 'Bad Request', `Failed to convert '${name}' with value: '${query[name]}'`); } };
                return coupons.latest(integer('countryId'), integer('brandId'), integer('storeId'), query.couponCode!);
              })();
            result = response(200, envelope(path === '/coupons/redeem' ? 201 : 200, path, output.uid, output.message, output.data), controllerHeaders);
          } catch (error) {
            if (error instanceof AppError || error instanceof HttpProblem) throw error;
            throw technical(error instanceof Error ? error.message : '', error);
          }
        } else result = frameworkError(404, 'Not Found', path);
      } catch (error) {
        logError(error, 'request');
        if (error instanceof HttpProblem) {
          result = problemResponse(error, path); Object.assign(result.headers, controllerHeaders); metric('ValidationErrors');
        } else {
        const mapped = publicError(error);
        metric(mapped.status >= 500 || error instanceof AppError && error.kind === 'technical' ? 'TechnicalErrors'
          : error instanceof AppError && error.kind === 'validation' ? 'ValidationErrors' : 'BusinessErrors');
        result = response(mapped.status, envelope(mapped.status, path, randomUUID(), mapped.message, null, false), controllerHeaders);
        }
      }
      // Los DTO sin produces se negocian al escribir, después de sus efectos.
      // No adelantar esta comprobación: validación y canje pueden haber persistido.
      try {
        if (result.body && result.headers['Content-Type'] === 'application/problem+json') {
          parseAccept(headers.accept); // ProblemDetail admite fallback RFC 7807.
        } else if (result.body && (path === '/auth/token' || path.startsWith('/coupons/') && path !== '/coupons/healthcheck' && routes.has(path))) {
          result.headers['Content-Type'] = representation(negotiate(headers.accept, jsonTypes));
        } else if (result.body && path === '/test-insights') {
          const selected = representation(negotiate(headers.accept, ['text/plain', '*/*', ...jsonTypes]));
          result.headers['Content-Type'] = selected + (/^application\/(?:[^;]+\+)?json(?:;|$)/i.test(selected) || /;charset=/i.test(selected) ? '' : ';charset=UTF-8');
        }
      } catch (error) {
        if (!(error instanceof HttpProblem)) throw error;
        metric('NegotiationErrors'); logError(error, 'negotiation');
        // Spring no escribe el cuerpo de un error cuando Accept es ilegible.
        if (error.detail === 'Could not parse Accept header.' && result.statusCode >= 400) {
          result.body = ''; delete result.headers['Content-Type'];
        } else {
          result = problemResponse(error, path); Object.assign(result.headers, controllerHeaders);
          try { parseAccept(headers.accept); } catch { result.body = ''; delete result.headers['Content-Type']; }
        }
      }
      metric('Requests'); metric('Duration', Math.round(performance.now() - started), 'Milliseconds');
      log('info', 'request.completed', { status: result.statusCode, durationMs: Math.round(performance.now() - started) });
      result.headers = { ...securityHeaders, ...result.headers };
      if (event.httpMethod === 'HEAD') result.body = '';
      return result;
    });
  };
}
function assertJsonMediaType(event: HttpEvent, contentType?: string): void {
  if (!event.body) return;
  const mediaType = contentType?.split(';')[0]?.trim().toLowerCase() ?? 'application/octet-stream';
  if (mediaType !== 'application/json' && !/^application\/.+\+json$/.test(mediaType)) throw new HttpProblem(415, 'Unsupported Media Type', `Content-Type '${contentType ?? 'application/octet-stream'}' is not supported.`, { Accept: 'application/json, application/*+json' });
}
