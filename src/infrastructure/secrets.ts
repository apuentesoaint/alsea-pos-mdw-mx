import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import type { SecretReader } from '../core/types.js';
import { log, metric } from '../core/logging.js';
import { awsSignal } from '../core/deadline.js';

export class CachedSecrets implements SecretReader {
  private readonly cache = new Map<string, { expires: number; value: Record<string, unknown> }>();
  private readonly pending = new Map<string, Promise<Record<string, unknown>>>();
  constructor(private readonly client = new SecretsManagerClient({ maxAttempts: 3, requestHandler: { connectionTimeout: 1000, requestTimeout: 5000 } }), private readonly ttl = 300_000) {}
  async get<T extends Record<string, unknown>>(id: string): Promise<T> {
    if (!id) throw new Error('Identificador de secreto no configurado');
    const cached = this.cache.get(id);
    if (cached && cached.expires > Date.now()) return cached.value as T;
    const existing = this.pending.get(id);
    if (existing) return await existing as T;
    const request = this.retrieve(id);
    this.pending.set(id, request);
    try { return await request as T; } finally { this.pending.delete(id); }
  }
  private async retrieve(id: string): Promise<Record<string, unknown>> {
    try {
      const response = await this.client.send(new GetSecretValueCommand({ SecretId: id }), { abortSignal: awsSignal() });
      const text = response.SecretString ?? (response.SecretBinary ? Buffer.from(response.SecretBinary).toString('utf8') : undefined);
      if (!text) throw new Error('Secreto sin versión cargada');
      const value: unknown = JSON.parse(text);
      if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Formato de secreto inválido');
      this.cache.set(id, { expires: Date.now() + this.ttl, value: value as Record<string, unknown> });
      return value as Record<string, unknown>;
    } catch (error) {
      metric('SecretErrors'); log('error', 'secret.failed', { errorType: error instanceof Error ? error.name : 'UnknownError' });
      throw new Error('No fue posible cargar la configuración segura', { cause: error });
    }
  }
}
