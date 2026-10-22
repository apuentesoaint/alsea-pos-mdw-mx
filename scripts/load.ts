import { parseArgs } from 'node:util';
import { performance } from 'node:perf_hooks';

const { values } = parseArgs({ options: { url: { type: 'string' }, rps: { type: 'string', default: '50' }, seconds: { type: 'string', default: '600' }, method: { type: 'string', default: 'GET' }, file: { type: 'string' } } });
if (!values.url) throw new Error('Indicar --url de un entorno de pruebas');
const url = new URL(values.url);
if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Se requiere HTTPS');
const rps = Number(values.rps); const seconds = Number(values.seconds);
if (!Number.isFinite(rps) || rps <= 0 || rps > 1000 || !Number.isFinite(seconds) || seconds <= 0 || seconds > 3600) throw new Error('Carga fuera de límites: 1–1000 rps, máximo 3600 segundos');
const body = values.file ? await (await import('node:fs/promises')).readFile(values.file, 'utf8') : undefined;
const token = process.env.LOAD_BEARER_TOKEN;
const latencies: number[] = []; let failures = 0; let skipped = 0;
const pending = new Set<Promise<void>>();
const started = performance.now();
for (let index = 0; index < rps * seconds; index++) {
  const wait = started + index * 1000 / rps - performance.now();
  if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
  if (pending.size >= 2000) { skipped++; continue; }
  const request = (async () => {
    const begin = performance.now();
    try {
      const response = await fetch(url, { method: values.method, body, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, signal: AbortSignal.timeout(29_000) });
      await response.arrayBuffer(); if (!response.ok) failures++;
    } catch { failures++; }
    latencies.push(performance.now() - begin);
  })();
  pending.add(request); void request.finally(() => pending.delete(request));
}
await Promise.all(pending);
latencies.sort((a, b) => a - b);
const percentile = (value: number) => latencies[Math.max(0, Math.ceil(latencies.length * value) - 1)] ?? 0;
console.info(JSON.stringify({ requests: latencies.length, failures, skipped, p95: percentile(.95), p99: percentile(.99), elapsedSeconds: (performance.now() - started) / 1000 }));
if (failures || skipped || percentile(.95) > 3000 || percentile(.99) > 5000) process.exitCode = 1;
