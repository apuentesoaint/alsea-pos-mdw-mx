import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Decimal } from 'decimal.js';
import { additional, evaluateDiscount, promotionAmountDiscount, remapResult, rounded } from '../src/domain/discounts.js';
import { Coupons, generatedUid } from '../src/domain/coupons.js';
import { MemoryTransactions } from '../src/infrastructure/memory.js';
import { coupon, request, redeem } from './fixtures.js';
import type { CouponProvider, Item } from '../src/core/types.js';
import { validateBody } from '../src/core/validation.js';

test('porcentaje y remapeo de códigos respetan el Java', () => {
  const input = request(); const external = coupon(); const result = evaluateDiscount(input, external).result!;
  assert.equal(String(result.totalDiscount), '20'); remapResult(result, input, external);
  assert.equal(result.couponType, 3); assert.equal(result.discountId, '7002');
});
test('redondeos Colombia, Chile y México', () => {
  assert.equal(rounded(new Decimal('1.235'), 2).toFixed(), '1');
  assert.equal(rounded(new Decimal('1.231'), 3).toFixed(), '1.24');
  assert.equal(rounded(new Decimal('1.235'), 1).toFixed(), '1.24');
});
test('monto fijo acotado al saldo y a artículos participantes', () => {
  const input = request(); const external = coupon(3, '50'); external.cupon.fnMontoDisponible = '20';
  const result = evaluateDiscount(input, external).result!;
  assert.equal(String(result.totalDiscount), '20'); assert.equal(input.itemsOrder![0]!.amount, '80');
});
test('monto mínimo y nivel de precio validan antes de guardar', () => {
  const input = request(); const external = coupon(); external.restricciones = [{ fiTipoRestriccionID: 1, fcValor: '101' }];
  assert.throws(() => evaluateDiscount(input, external), /menor al monto mínimo/);
  external.restricciones = []; external.fcCampoAdicion2 = '{"fcNivelesDePrecio":",1,,2,incorrecto,"}';
  input.itemsOrder![0]!.priceLevel = 3;
  assert.throws(() => evaluateDiscount(input, external), /Niveles permitidos: \[1, 2\]/);
});
test('additionalField2 limpia comillas simples y rechaza campos no mapeados', () => {
  assert.equal(additional("{'fcBines':'1,2'}").fcBines, '1,2');
  assert.throws(() => additional('{"unknown":1}'), /additionalField2 no tiene un formato válido/);
});
test('frecuencia sigue sin implementación', () => assert.equal(evaluateDiscount(request(), coupon(7)).result, null));
test('Chipotle conserva código del cupón, productos rewards y override de descuento', () => {
  const input = request(); input.brandId = 60;
  const external = coupon(2); external.fcCampoAdicion2 = '{"fcPromocionesSBXRload":{"fcRewardsProducts":"123,456","fcIDDiscount":" 900 "}}';
  const result = evaluateDiscount(input, external).result!;
  assert.equal(result.code, 'TEST001'); assert.equal(result.discountId, '123');
  remapResult(result, input, external); assert.equal(result.discountId, '900'); assert.equal(result.couponType, 2);
});
test('NxM mantiene la distribución del método calculatePromotionAmountDiscount', () => {
  const items = request().itemsOrder!; items[0]!.quantity = 2; items[0]!.amount = '160';
  assert.equal(promotionAmountDiscount(items, new Decimal(99), 2).toFixed(), '61');
  assert.equal(promotionAmountDiscount(items, new Decimal(200), 2).toFixed(), '0');
});
test('la réplica sigue el método actual aunque el test Java heredado espere otro valor', () => {
  const items = [{ amount: '100' }, { amount: '80' }] as Item[];
  // El código fuente resta 30 una vez (150), mientras el test Java heredado espera 120.
  assert.equal(promotionAmountDiscount(items, new Decimal(30), 2).toFixed(), '150');
});
test('UID preserva sucursal, marca y timestamp base36 con milisegundos', () => {
  assert.equal(generatedUid(12, 11, 1000), 'UID00012BKRS');
  assert.notEqual(generatedUid(12, 11, 1000), generatedUid(12, 11, 1001));
});
test('familia ligada y tope porcentual respetan multivalor y precio de los artículos', () => {
  const input = request(); input.itemsOrder![0]!.quantity = 3; input.totalOrder = '300';
  const external = coupon(1, '20'); external.restricciones = [{ fiTipoRestriccionID: 3, fiMultivalor: 1, fcValor: '1' }, { fiTipoRestriccionID: 4, fcValor: '200' }];
  assert.equal(String(evaluateDiscount(input, external).result!.totalDiscount), '40');
});
test('NxM completo aplica la promoción a unidades expandidas', () => {
  const input = request(); input.itemsOrder![0]!.quantity = 2;
  const external = coupon(5); external.restricciones = [{ fiTipoRestriccionID: 8, fcValor: '1' }];
  external.fcCampoAdicion2 = JSON.stringify({ fcNumAdicionales: '0', fcNumArticulosPromocion: '10', fcPromocionesNxM: { fcNxMUnidadVendida: '2', fcNxMUnidadPromocionNArticulo: '1', fcNxMUnidadPromocionMonto: '0' } });
  assert.equal(String(evaluateDiscount(input, external).result!.totalDiscount), '100');
});
test('empleados Chile conserva lista de pagos y límites de artículos', () => {
  const input = request(); input.countryId = 3;
  const external = coupon(6, '20'); external.restricciones = [{ fiTipoRestriccionID: 3, fcValor: '1', fiMultivalor: 1 }];
  const result = evaluateDiscount(input, external).result!;
  assert.equal(String(result.totalDiscount), '20'); assert.deepEqual(result.paymentMethodApply, [4, 5, 6, 14, 20, 21, 26, 94, 1106, 9001, 1132, 1104, 1130]);
});
test('forma de pago conserva el cálculo y el remapeo de tipo', () => {
  const input = request(); const external = coupon(4, '20'); external.restricciones = [{ fiTipoRestriccionID: 10, fcValor: '999' }];
  external.cupon.fnFormaPagoMarca = 34;
  const result = evaluateDiscount(input, external).result!; remapResult(result, input, external);
  assert.equal(String(result.totalDiscount), '20'); assert.equal(result.couponType, 9); assert.equal(result.discountId, '34');
});
test('bines ignora tokens vacíos mientras pagos conserva su parser Java separado', () => {
  const external = coupon(); external.fcCampoAdicion2 = '{"fcBines":",1,,2,","fcFPagoLigadaAdicional":",3,4,"}';
  const result = evaluateDiscount(request(), external).result!;
  assert.deepEqual(result.binesList, [1, 2]); assert.deepEqual(result.paymentMethodApply, [3, 4]);
  external.fcCampoAdicion2 = '{"fcFPagoLigadaAdicional":"1,,2"}';
  assert.throws(() => evaluateDiscount(request(), external), /For input string/);
});
test('niveles fuera de Integer Java se ignoran en la configuración del proveedor', () => {
  const external = coupon(); external.fcCampoAdicion2 = '{"fcNivelesDePrecio":"2147483648"}';
  const input = request(); input.itemsOrder![0]!.priceLevel = 1;
  assert.ok(evaluateDiscount(input, external).result);
});
test('validar, consultar y canjear preserva estados, pagos duplicados y filtros', async () => {
  const repository = new MemoryTransactions();
  const provider: CouponProvider = { async validate() { return coupon(); }, async redeem() { return { folioCuponId: 'TEST001' }; }, async generate() { return { coupon: { code: 'GENERATED' } }; } };
  const service = new Coupons(repository, provider);
  await service.validate(request()); assert.equal((await service.latest(1, 11, 1, 'TEST001')).data?.redeemed, false);
  await service.redeem(redeem());
  assert.deepEqual((await repository.get('test-uid', 1))?.payments, [1, 2, 1]);
  assert.equal((await service.latest(1, 11, 1, 'TEST001')).data, null);
});
test('la validación descartada persiste antes del error, como en Java', async () => {
  const repository = new MemoryTransactions(); const external = coupon(); external.restricciones = [{ fiTipoRestriccionID: 2, fcValor: '999' }];
  const service = new Coupons(repository, { async validate() { return external; }, async redeem() { throw new Error(); }, async generate() { throw new Error(); } });
  await assert.rejects(service.validate(request()), /Items\/Familia no participantes/);
  assert.ok(await repository.get('test-uid', 1));
});
test('null dentro de items conserva el efecto de guardar antes del fallo final del Java', async () => {
  const repository = new MemoryTransactions();
  const service = new Coupons(repository, { async validate() { return coupon(); }, async redeem() { throw new Error(); }, async generate() { throw new Error(); } });
  const input = validateBody(JSON.stringify({ ...request(), itemsOrder: [null] }));
  await assert.rejects(service.validate(input), /isDescart/);
  assert.equal((await repository.get('test-uid', 1))?.itemRequest, '[null]');
});
test('lista ausente sigue fallando antes de guardar para porcentaje', async () => {
  const repository = new MemoryTransactions();
  const service = new Coupons(repository, { async validate() { return coupon(); }, async redeem() { throw new Error(); }, async generate() { throw new Error(); } });
  const input = request(); input.itemsOrder = null;
  await assert.rejects(service.validate(input)); assert.equal(repository.records.size, 0);
});
test('un valor pequeño con exponente no se convierte a cero en el detalle persistido', async () => {
  const repository = new MemoryTransactions();
  const service = new Coupons(repository, { async validate() { return coupon(); }, async redeem() { throw new Error(); }, async generate() { throw new Error(); } });
  const input = validateBody(JSON.stringify({ ...request(), itemsOrder: [{ ...request().itemsOrder![0], amount: '1e-7' }] }));
  await service.validate(input);
  assert.equal(JSON.parse((await repository.get('test-uid', 1))!.itemRequest!)[0].amount, 1e-7);
});
test('matriz de promociones, países y marcas conserva importe, remapeo y persistencia', async () => {
  // Expectativas derivadas de los siete métodos Java y CouponModify, sin ejecutar Java.
  for (const countryId of [1, 2, 3]) for (const brandId of [10, 11, 20, 60]) for (const type of [1, 2, 3, 4, 5, 6, 7]) {
    const input = request(); input.countryId = countryId; input.brandId = brandId;
    const external = coupon(type, '20'); external.cupon.fnFormaPagoMarca = 34;
    if (type === 4 || type === 6) external.restricciones = [{ fiTipoRestriccionID: 4, fcValor: '100' }];
    if (type === 5) {
      input.itemsOrder![0]!.quantity = 2; input.totalOrder = '200'; external.restricciones = [{ fiTipoRestriccionID: 8, fcValor: '1' }];
      external.fcCampoAdicion2 = '{"fcNumAdicionales":"0","fcNumArticulosPromocion":"10","fcPromocionesNxM":{"fcNxMUnidadVendida":"2","fcNxMUnidadPromocionNArticulo":"1","fcNxMUnidadPromocionMonto":"0"}}';
    }
    const repository = new MemoryTransactions();
    const service = new Coupons(repository, { async validate() { return external; }, async redeem() { throw new Error(); }, async generate() { throw new Error(); } });
    const result = await service.validate(input);
    const label = `${countryId}/${brandId}/${type}`;
    if (type === 7) { assert.equal(result.data, null, label); assert.equal(repository.records.size, 0, label); continue; }
    assert.equal(String(result.data!.totalDiscount), type === 2 ? '0' : type === 5 ? '100' : '20', label);
    const chipotle = brandId === 20 || brandId === 60;
    assert.equal(result.data!.couponType, chipotle && [1, 2].includes(type) ? type : ({ 1: 3, 2: 1, 3: 3, 4: 9, 5: 3, 6: 8 } as Record<number, number>)[type], label);
    assert.equal((await repository.get('test-uid', 1))!.brandId, brandId === 20 ? 60 : brandId, label);
    assert.ok((await service.latest(countryId, brandId === 20 ? 60 : brandId, 1, 'TEST001')).data, label);
  }
});
test('valor de porcentaje nulo no se interpreta como descuento cero ni se persiste', async () => {
  const repository = new MemoryTransactions(); const external = coupon(); external.cupon.fcValorCupon = null;
  const service = new Coupons(repository, { async validate() { return external; }, async redeem() { throw new Error(); }, async generate() { throw new Error(); } });
  await assert.rejects(service.validate(request())); assert.equal(repository.records.size, 0);
});
test('modificador nulo se conserva cuando el cálculo no lo usa, igual que Gson', async () => {
  const repository = new MemoryTransactions();
  const service = new Coupons(repository, { async validate() { return coupon(); }, async redeem() { throw new Error(); }, async generate() { throw new Error(); } });
  const input = validateBody(JSON.stringify({ ...request(), itemsOrder: [{ ...request().itemsOrder![0], modifiers: [null] }] }));
  await service.validate(input);
  assert.deepEqual(JSON.parse((await repository.get('test-uid', 1))!.itemRequest!)[0].modifiers, [null]);
});
