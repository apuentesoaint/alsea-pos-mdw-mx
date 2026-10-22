import { loadConfig } from './core/config.js';
import { createApplication } from './http/application.js';
import { Coupons } from './domain/coupons.js';
import { Authentication } from './domain/auth.js';
import { CachedSecrets } from './infrastructure/secrets.js';
import { DynamoTransactions } from './infrastructure/repository.js';
import { DigitalCoupons } from './infrastructure/providers.js';
import { transport } from './infrastructure/http.js';

async function compose() {
  const config = loadConfig();
  const secrets = new CachedSecrets(undefined, config.secretCacheMs);
  const repository = new DynamoTransactions(config.table, config.bucket);
  const provider = new DigitalCoupons(config, secrets, transport(config.httpTimeoutMs));
  // Composición acotada y sin peticiones de red durante la inicialización.
  return createApplication(new Authentication(config, secrets), new Coupons(repository, provider));
}
export const application = await compose();
