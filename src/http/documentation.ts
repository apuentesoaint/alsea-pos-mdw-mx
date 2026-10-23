import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HttpEvent, HttpResponse } from './application.js';
import { openapi } from '../contracts/openapi.js';
import { stringify as yaml } from 'yaml';
import { HttpProblem, problemResponse } from './problems.js';

const assets = new Set(['index.html', 'swagger-ui.css', 'swagger-ui-bundle.js', 'swagger-ui-standalone-preset.js', 'swagger-initializer.js', 'favicon-16x16.png', 'favicon-32x32.png', 'oauth2-redirect.html']);
const contentTypes: Record<string, string> = { css: 'text/css', js: 'text/javascript', html: 'text/html', png: 'image/png' };
export async function documentation(event: HttpEvent): Promise<HttpResponse> {
  const path = event.path;
  // La URL execute-api contiene el stage; un dominio personalizado puede mapearlo en la raíz.
  const stage = event.requestContext?.stage;
  const executeApi = /^[a-z0-9-]+\.execute-api\.[a-z0-9-]+\.amazonaws\.com$/.test(event.requestContext?.domainName ?? '');
  const prefix = process.env.PUBLIC_BASE_PATH || (executeApi && stage ? `/${encodeURIComponent(stage)}` : '');
  if (['/swagger-ui.html', '/swagger-ui', '/swagger-ui/'].includes(path)) return { statusCode: 302, headers: { Location: `${prefix}/swagger-ui/index.html` }, body: '' };
  if (path === '/v3/api-docs') return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(openapi()) };
  if (path === '/v3/api-docs.yaml') return { statusCode: 200, headers: { 'Content-Type': 'application/vnd.oai.openapi' }, body: yaml(openapi()) };
  if (path === '/v3/api-docs/swagger-config') return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
    configUrl: `${prefix}/v3/api-docs/swagger-config`, oauth2RedirectUrl: `${prefix}/swagger-ui/oauth2-redirect.html`,
    url: `${prefix}/v3/api-docs`, validatorUrl: '',
  }) };
  const asset = path.replace(/^\/(?:swagger-ui\/|webjars\/swagger-ui\/(?:5\.2\.0\/)?)/, '');
  if ((path.startsWith('/swagger-ui/') || path.startsWith('/webjars/swagger-ui/')) && assets.has(asset)) {
    if (asset === 'swagger-initializer.js') return { statusCode: 200, headers: { 'Content-Type': 'text/javascript' },
      body: `window.onload = function () { window.ui = SwaggerUIBundle({configUrl:${JSON.stringify(`${prefix}/v3/api-docs/swagger-config`)},dom_id:'#swagger-ui',deepLinking:true,presets:[SwaggerUIBundle.presets.apis,SwaggerUIStandalonePreset],layout:'StandaloneLayout'}); };` };
    const bytes = await readFile(resolve('assets/swagger', asset));
    const binary = asset.endsWith('.png');
    return { statusCode: 200, headers: { 'Content-Type': contentTypes[asset.split('.').at(-1)!] ?? 'application/octet-stream' }, body: bytes.toString(binary ? 'base64' : 'utf8'), isBase64Encoded: binary };
  }
  return problemResponse(new HttpProblem(404, 'Not Found', `No static resource ${path.replace(/^\//, '')}.`), path);
}
