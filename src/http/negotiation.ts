import { HttpProblem } from './problems.js';

interface MediaType { type: string; subtype: string; parameters: Map<string, string>; quality: number }
const token = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
export const jsonTypes = ['application/json', 'application/*+json'];

function qualityValue(raw: string): number {
  const value = raw.replace(/^[\x00-\x20]+|[\x00-\x20]+$/g, '');
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?[fFdD]?$/.test(value)) return Number(value.replace(/[fFdD]$/, ''));
  const hex = /^([+-]?)0[xX]([\da-fA-F]+(?:\.[\da-fA-F]*)?|\.[\da-fA-F]+)[pP]([+-]?\d+)[fFdD]?$/.exec(value);
  if (!hex) return NaN;
  const [integer, fraction = ''] = hex[2]!.split('.');
  const mantissa = parseInt(integer || '0', 16) + [...fraction].reduce((sum, digit, index) => sum + parseInt(digit, 16) / 16 ** (index + 1), 0);
  return (hex[1] === '-' ? -1 : 1) * mantissa * 2 ** Number(hex[3]);
}

function split(value: string, delimiter: string): string[] {
  const result: string[] = []; let start = 0; let quoted = false; let escaped = false;
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (escaped) { escaped = false; continue; }
    if (quoted && char === '\\') { escaped = true; continue; }
    if (char === '"') quoted = !quoted;
    else if (!quoted && char === delimiter) { result.push(value.slice(start, index)); start = index + 1; }
  }
  if (quoted || /[\r\n\x00]/.test(value)) throw new Error('Invalid media type');
  result.push(value.slice(start)); return result;
}
function mediaType(raw: string): MediaType {
  const [name, ...parts] = split(raw, ';');
  const normalized = name!.trim() === '*' ? '*/*' : name!.trim();
  const names = normalized.split('/');
  if (names.length !== 2 || names.some(value => !token.test(value)) || names[0] === '*' && names[1] !== '*') throw new Error('Invalid media type');
  const parameters = new Map<string, string>();
  for (const part of parts) {
    if (!part.trim()) continue;
    const equals = part.indexOf('=');
    // MimeTypeUtils omite parámetros sin '='.
    if (equals < 0) continue;
    const key = part.slice(0, equals).trim().toLowerCase(); const value = part.slice(equals + 1).trim();
    if (!token.test(key) || !(token.test(value) || /^"[^\r\n]*"$/.test(value))) throw new Error('Invalid media parameter');
    parameters.set(key, value);
  }
  const rawQuality = parameters.get('q')?.replace(/^"|"$/g, '');
  const quality = rawQuality === undefined ? 1 : qualityValue(rawQuality);
  if (rawQuality === '' || !Number.isFinite(quality) || quality < 0 || quality > 1) throw new Error('Invalid quality');
  const charset = parameters.get('charset')?.replace(/^"|"$/g, '');
  if (charset && !['utf-8', 'utf8', 'iso-8859-1', 'iso8859-1', 'us-ascii', 'ascii', 'utf-16', 'utf-16le', 'utf-16be'].includes(charset.toLowerCase())) {
    // Validar el nombre antes de permitir que llegue a una cabecera de respuesta.
    try { new TextDecoder(charset); } catch { throw new Error('Invalid charset'); }
  }
  return { type: names[0]!.toLowerCase(), subtype: names[1]!.toLowerCase(), parameters, quality };
}
function wildcardSubtype(value: MediaType) { return value.subtype === '*' || value.subtype.startsWith('*+'); }
function moreSpecific(a: MediaType, b: MediaType): boolean {
  if (a.quality !== b.quality) return a.quality > b.quality;
  if (a.type === '*' || b.type === '*') return a.type !== '*' && b.type === '*';
  if (a.type !== b.type) return false;
  if (wildcardSubtype(a) !== wildcardSubtype(b)) return !wildcardSubtype(a);
  if (a.subtype !== b.subtype) return false;
  return a.parameters.size > b.parameters.size;
}
function sort(types: MediaType[]): MediaType[] {
  // Spring usa orden parcial estable: tipos concretos distintos conservan orden.
  for (let end = types.length - 1; end > 0; end--) for (let index = 0; index < end; index++) {
    if (moreSpecific(types[index + 1]!, types[index]!)) [types[index], types[index + 1]] = [types[index + 1]!, types[index]!];
  }
  return types;
}
export function parseAccept(raw?: string): MediaType[] {
  try {
    const values = raw ? split(raw, ',').map(value => value.trim()).filter(Boolean) : [];
    // MimeTypeUtils.sortBySpecificity de Spring 6.1.3 admite hasta 50 elementos.
    if (values.length > 50) throw new Error('Too many media types');
    return sort((values.length ? values : ['*/*']).map(mediaType));
  } catch { throw new HttpProblem(406, 'Not Acceptable', 'Could not parse Accept header.'); }
}
function compatible(a: MediaType, b: MediaType): boolean {
  if (a.type === '*' || b.type === '*') return true;
  if (a.type !== b.type) return false;
  if (a.subtype === b.subtype || a.subtype === '*' || b.subtype === '*') return true;
  const suffix = (value: string) => value.includes('+') ? value.slice(value.lastIndexOf('+') + 1) : '';
  return a.subtype.startsWith('*+') && (b.subtype === suffix(a.subtype) || suffix(b.subtype) === suffix(a.subtype))
    || b.subtype.startsWith('*+') && (a.subtype === suffix(b.subtype) || suffix(a.subtype) === suffix(b.subtype));
}
function render(value: MediaType): string {
  return `${value.type}/${value.subtype}` + [...value.parameters].filter(([key]) => key !== 'q').map(([key, item]) => `;${key}=${item}`).join('');
}
export function notAcceptable(supported: string[]): HttpProblem {
  return new HttpProblem(406, 'Not Acceptable', `Acceptable representations: [${supported.join(', ')}].`, { Accept: supported.join(', ') });
}
/** El transporte actual emite UTF-8. No anunciar otra codificación sin codificar
 * realmente los bytes y comprobar el modo binario de REST API en AWS. */
export function utf8Representation(selected: string): { contentType: string; pendingCharset: boolean } {
  const type = mediaType(selected);
  const charset = type.parameters.get('charset')?.replace(/^"|"$/g, '').toLowerCase();
  const pendingCharset = charset !== undefined && !['utf-8', 'utf8'].includes(charset);
  if (pendingCharset) type.parameters.delete('charset');
  return { contentType: render(type), pendingCharset };
}
/** Selección equivalente al escritor MVC; no filtra q=0: conserva Spring 6.1.3. */
export function negotiate(accept: string | undefined, supported: string[]): string {
  const candidates: MediaType[] = [];
  for (const requested of parseAccept(accept)) for (const available of supported.map(mediaType)) {
    if (!compatible(requested, available)) continue;
    const produced = { ...available, parameters: new Map(available.parameters), quality: requested.quality };
    if (requested.parameters.has('q')) produced.parameters.set('q', requested.parameters.get('q')!);
    candidates.push(moreSpecific(produced, requested) ? produced : requested);
  }
  for (const candidate of sort(candidates)) {
    if (candidate.type !== '*' && !wildcardSubtype(candidate)) return render(candidate);
    if ((candidate.type === '*' || candidate.type === 'application') && candidate.subtype === '*') return 'application/octet-stream';
  }
  throw notAcceptable(supported);
}
/** Las cabeceras multivalor de REST API contienen los valores completos. */
export function requestHeaders(single: Record<string, string | undefined>, multiple?: Record<string, string[] | undefined> | null): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(single)) result[key.toLowerCase()] = value;
  for (const [key, values] of Object.entries(multiple ?? {})) if (values?.length) result[key.toLowerCase()] = values.join(',');
  return result;
}
