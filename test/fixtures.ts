import { loadConfig } from '../src/core/config.js';
import type { ExternalCoupon, GenerateRequest, RedeemRequest, SecretReader, ValidateRequest } from '../src/core/types.js';
export const config = () => ({ ...loadConfig(), authSecret: 'test/auth', signingSecret: 'test/signing', cuponeraSecret: 'test/cu ponera', starbucksSecret: 'test/starbucks',
  tokenUrl: 'https://provider.invalid/token', validateUrl: 'https://provider.invalid/coupons/', redeemUrl: 'https://provider.invalid/redeem', generateUrl: 'https://provider.invalid/generate',
  starbucksUrl: 'https://starbucks.invalid', starbucksVersion: '/v1', starbucksTokenPath: '/token', starbucksCouponPath: '/coupons' });
export const secrets: SecretReader = { async get<T extends Record<string, unknown>>(id: string) {
  return (id.includes('signing') ? { keyBase64: Buffer.alloc(48, 7).toString('base64') } : id.includes('cu ponera') ? { basic: 'TEST_ONLY' } : { clientId: 'test-client', clientSecret: 'test-secret' }) as unknown as T;
} };
export function request(): ValidateRequest { return { countryId: 1, brandId: 11, storeId: 1, posId: 1, orderNumber: 12,
  couponCode: 'TEST001', typeOrder: '1', totalOrder: '100', itemsOrder: [{ idItem: 1, familyId: 1, amount: '100', quantity: 1, modifiers: [], descart: false, multivalue: false }] }; }
export function coupon(type = 1, value = '20'): ExternalCoupon { return { fcUID: 'test-uid', fcTokenRedencion: 'TEST_ONLY_TOKEN',
  cupon: { fcFolioCuponID: 'TEST001', fiTipoPromocionID: type, fiTipoCuponID: 1, fcValorCupon: value, fnFormaPagoMarca: 1 }, restricciones: [], fcCampoAdicion2: '{}' }; }
export function redeem(): RedeemRequest { return { countryId: 1, brandId: 11, storeId: 1, posID: '1', couponCode: 'TEST001', typeOrder: '1', paymentMethodId: '1,2,1',
  totalOrderWithOutDiscount: '100', totalOrder: '80', totalDiscountOrder: '20', employeID: 1, ticketId: '10', fechaCanje: '2026-10-22', uid: 'test-uid' }; }
export function generate(): GenerateRequest { return { request: { campaign_id: 'ignored-by-java', coupon_type: 1, broadcast_channel: 'app', brandId: 60, countryId: 1 }, customer: { id: 'test-user', name: 'Usuario de prueba' } }; }
