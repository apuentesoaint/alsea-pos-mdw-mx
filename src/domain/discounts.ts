import { legacyRuntime } from '../core/legacy-errors.js';
import { Decimal } from 'decimal.js';
import { technical } from '../core/errors.js';
import { javaInteger } from '../core/validation.js';
import { javaDecimalText, scaled } from '../core/json.js';
import type { Additional, ExternalCoupon, Item, Modifier, Numeric, ValidateRequest, ValidateResult } from '../core/types.js';

// Precisión superior a los importes de contrato; cada división replica el redondeo explícito del Java.
Decimal.set({ precision: 80, rounding: Decimal.ROUND_HALF_UP });
const D = (value: Numeric | null | undefined) => {
  if (value == null) throw legacyRuntime('decimalNull');
  if (typeof value === 'string' && value !== value.trim()) throw technical('Valor BigDecimal inválido');
  const decimal = new Decimal(typeof value === 'string' ? javaDecimalText(value) : value);
  if (!decimal.isFinite()) throw technical('Valor BigDecimal inválido');
  return decimal;
};
const quantity = (value: number | null | undefined): number => {
  if (value == null) throw legacyRuntime('quantityNull');
  return value;
};
const modifierValue = (value: Modifier | null): Modifier => {
  if (value === null) throw legacyRuntime('modifierNull');
  return value;
};
function couponAmount(raw: string | null): Decimal {
  if (raw == null || raw.trim() === '') throw technical('El valor del cupón de descuento por monto es requerido');
  let amount: Decimal;
  try { amount = D(raw.trim()); } catch { throw technical(`El valor del cupón de descuento por monto no es válido: ${raw}`); }
  if (amount.lte(0)) throw technical(`El valor del cupón de descuento por monto debe ser mayor a cero: ${raw}`);
  return amount;
}
function javaDouble(raw: string | null | undefined): number {
  if (raw == null) throw legacyRuntime('doubleNull');
  if (raw.trim() === '') throw technical('empty String');
  const value = Number(raw.trim());
  if (!Number.isFinite(value)) throw technical(`For input string: "${raw}"`);
  return value;
}
const integerList = (value?: string | null): number[] => {
  if (value == null || value.trim() === '') return [];
  const values = (value.startsWith(',') ? value.slice(1) : value).split(',');
  while (values.length > 1 && values.at(-1) === '') values.pop(); // String.split de Java conserva el único vacío si la entrada está vacía.
  return values.map(javaInteger);
};
const binesList = (value?: string | null): number[] => value == null || value.trim() === '' ? [] : value.split(',').filter(token => token !== '').map(javaInteger);
const additionalFields = new Set(['fcFPagoLigadaAdicional', 'fcBines', 'fcPromocionesNxM', 'fcNivelesDePrecio', 'fcNumAdicionales', 'fcNumArticulosPromocion', 'fcPromocionesSBXRload']);
export function additional(raw?: string | null): Additional {
  if (raw == null || raw === '') return {};
  try {
    const value = JSON.parse(raw.replaceAll("'", '"').replaceAll('\u00a0', '').replace(/\\[nrt]|[\n\r\t]/g, ''));
    if (value === null || Array.isArray(value) || typeof value !== 'object' || Object.keys(value).some(key => !additionalFields.has(key))) throw new Error('Formato inválido');
    const nestedFields: Record<string, string[]> = {
      fcPromocionesNxM: ['fcNxMUnidadVendida', 'fcNxMUnidadPromocionNArticulo', 'fcNxMUnidadPromocionMonto', 'fcNxMIndicadorPromocion'],
      fcPromocionesSBXRload: ['fcBanderaRload', 'fcMontoPagoRload', 'fcMontoRegaloRload', 'fcRewardsProducts', 'fcIDDiscount'],
    };
    for (const [key, fields] of Object.entries(nestedFields)) {
      if (value[key] != null && (typeof value[key] !== 'object' || Array.isArray(value[key]) || Object.keys(value[key]).some(field => !fields.includes(field)))) throw new Error('Formato inválido');
      if (value[key] != null) for (const field of fields) if (value[key][field] != null) {
        if (typeof value[key][field] === 'object') throw new Error('Formato inválido');
        value[key][field] = String(value[key][field]);
      }
    }
    for (const key of additionalFields) if (!(key in nestedFields) && value[key] != null) {
      if (typeof value[key] === 'object') throw new Error('Formato inválido');
      value[key] = String(value[key]);
    }
    return value as Additional;
  } catch (cause) { throw technical('additionalField2 no tiene un formato válido. Verifica que no contenga saltos de línea o caracteres inválidos.', cause); }
}
export function rounded(value: Decimal, country: number): Decimal {
  const scale = country === 2 ? 0 : 2;
  return scaled(value.toDecimalPlaces(scale, country === 3 ? Decimal.ROUND_CEIL : Decimal.ROUND_HALF_UP), scale);
}
export function totalOrder(items: Item[]): Decimal {
  return items.reduce((sum, item) => sum.add(D(item.amount ?? 0).mul(item.quantity ?? 0))
    .add((item.modifiers ?? []).reduce((subtotal, modifier) => subtotal.add(D(modifierValue(modifier).amount)), D(0))), D(0));
}
export function promotionAmountDiscount(items: (Item | null)[], amount: Decimal, count: number): Decimal {
  let total = D(0); let remaining = count;
  for (const item of items) {
    if (item === null) throw legacyRuntime('itemAmountNull');
    const quantity = item.quantity ?? 1;
    if (quantity <= remaining) { total = total.add(D(item.amount ?? 0)); remaining -= quantity; }
    else { total = total.add(D(item.amount ?? 0).div(quantity).toDecimalPlaces(2).mul(remaining)); remaining = 0; }
    if (remaining <= 0) break;
  }
  return Decimal.max(total.sub(amount), 0);
}
export interface Evaluation { result: ValidateResult | null; rejectAfterSave: () => boolean }

/** Estado de cálculo exclusivo de una solicitud: sustituye al ThreadLocal del origen. */
class Calculation {
  total = D(0); minimum = D(0); maximum = D(0);
  constructor(readonly request: ValidateRequest, readonly coupon: ExternalCoupon, readonly extra: Additional) {}
  get items(): Item[] {
    if (this.request.itemsOrder == null) throw legacyRuntime('itemsNull');
    return this.request.itemsOrder.map(item => {
      if (item === null) throw legacyRuntime('itemDiscardNull');
      return item;
    });
  }
  participants(sorted = false): Item[] {
    const items = this.items.filter(item => !item.descart);
    return sorted ? items.sort((left, right) => D(left.amount).cmp(D(right.amount))) : items;
  }
  restrictions(): Map<number, Item[]> {
    const validations = new Map<number, Item[]>();
    if (this.coupon.restricciones == null) throw legacyRuntime('restrictionsNull');
    for (const restriction of this.coupon.restricciones) {
      const values = restriction.fcValor.split(/,\s*/);
      while (values.length > 1 && values.at(-1) === '') values.pop();
      const ids = values.map(javaInteger);
      const selected: Item[] = [];
      const kind = restriction.fiTipoRestriccionID;
      for (const item of this.items) {
        let matches = false;
        switch (kind) {
          case 1: this.minimum = D(ids[0]); matches = true; break;
          case 4: this.maximum = D(ids[0]); matches = true; break;
          case 5: case 6: matches = true; break;
          case 7: matches = ids.includes(item.typeItem!); break;
          case 2: case 8:
            matches = item.idItem !== null && ids.includes(item.idItem);
            if (matches) item.multivalue = restriction.fiMultivalor === 1; else item.descart = true;
            break;
          case 10: matches = item.idItem === null || !ids.includes(item.idItem); if (!matches) item.descart = true; break;
          case 3: matches = item.familyId !== null && ids.includes(item.familyId); item.descart = !matches; break;
          case 9: matches = item.familyId !== null && ids.includes(item.familyId); break;
          case 11: matches = item.familyId !== null && ids.includes(item.familyId); if (matches) item.descart = true; break;
        }
        if (matches) selected.push(item);
      }
      if (selected.length) validations.set(kind, selected);
    }
    const nxm = validations.get(8) ?? validations.get(9);
    if (nxm) for (const [kind, selected] of validations) {
      const filtered = selected.filter(item => nxm.includes(item));
      if (filtered.length) validations.set(kind, filtered); else validations.delete(kind);
    }
    return new Map([...validations].sort(([left], [right]) => left - right));
  }
  minimumRestriction(): void {
    if (totalOrder(this.items).lt(this.minimum)) throw technical(`El total de la orden es menor al monto mínimo requerido: ${this.minimum.toFixed()}`);
  }
  linkedFamily(discount: Decimal): void {
    const articleLimit = javaInteger(this.extra.fcNumArticulosPromocion?.trim() || '0');
    const modifierLimit = javaInteger(this.extra.fcNumAdicionales?.trim() || '0');
    const multivalue = this.coupon.restricciones?.find(value => value.fiTipoRestriccionID === 3)?.fiMultivalor === 1;
    let articles = 0; let modifiers = 0;
    for (const item of this.participants(true)) {
      if (articleLimit > 0 && articles >= articleLimit) break;
      const appliedQuantity = Math.min(multivalue ? quantity(item.quantity) : 1, articleLimit > 0 ? articleLimit - articles : Infinity);
      this.total = this.total.add(D(item.amount).mul(appliedQuantity).mul(discount));
      item.amount = D(item.amount).sub(D(item.amount).mul(discount)).toFixed(); articles += appliedQuantity;
      for (const rawModifier of item.modifiers ?? []) {
        const available = modifierLimit - modifiers;
        if (available <= 0) break;
        const modifier = modifierValue(rawModifier);
        if (modifier.amount != null && D(modifier.amount).gt(0) && (modifier.quantity ?? 0) > 0) {
          const applied = Math.min(modifier.quantity!, available);
          this.total = this.total.add(D(modifier.amount).div(modifier.quantity!).toDecimalPlaces(2).mul(applied).mul(discount));
          modifiers += applied;
        }
      }
    }
  }
  linkedItem(discount: Decimal): void {
    if (this.extra.fcNumArticulosPromocion != null && this.extra.fcNumArticulosPromocion !== '') {
      const articleLimit = javaInteger(this.extra.fcNumArticulosPromocion);
      const modifierLimit = javaInteger(this.extra.fcNumAdicionales?.trim() || '0');
      let articles = 0; let modifiers = 0;
      for (const item of this.participants(true)) {
        const available = Math.abs(articleLimit - articles);
        let availableModifiers = Math.abs(modifierLimit - modifiers);
        if (available === 0 && availableModifiers === 0) break;
        if (available > 0) { const applied = Math.min(quantity(item.quantity), available); this.total = this.total.add(D(item.amount).mul(applied).mul(discount)); articles += applied; }
        if (availableModifiers > 0) {
          if (item.modifiers == null) throw legacyRuntime('modifiersNull');
          for (const rawModifier of item.modifiers) {
            const modifier = modifierValue(rawModifier);
            if (modifier.amount != null && D(modifier.amount).gt(0) && availableModifiers > 0) {
              const applied = Math.min(quantity(modifier.quantity), availableModifiers);
              this.total = this.total.add(D(modifier.amount).mul(applied).mul(discount));
              modifiers += applied; availableModifiers = Math.abs(modifierLimit - modifiers);
            }
          }
        }
      }
    } else for (const item of this.participants()) {
      this.total = this.total.add(D(item.amount).mul(item.multivalue ? quantity(item.quantity) : 1).mul(discount));
      item.amount = D(item.amount).sub(D(item.amount).mul(discount)).toFixed();
    }
  }
  excludedProducts(discount: Decimal): void {
    for (const item of this.participants()) {
      this.total = this.total.add(D(item.amount).mul(quantity(item.quantity)).mul(discount));
      item.amount = D(item.amount).sub(D(item.amount).mul(discount)).toFixed();
    }
  }
  maximumRestriction(discount: Decimal): void {
    const items = this.participants();
    if (totalOrder(items).mul(discount).gt(this.maximum)) {
      for (const item of items) item.amount = D(item.amount).sub(D(item.amount).mul(discount)).toFixed();
      this.total = this.maximum.toDecimalPlaces(1);
    } else this.excludedProducts(discount);
  }
  employeeMaximum(discount: Decimal): void {
    let modifiers = 0;
    const limit = Math.max(0, javaInteger(this.extra.fcNumAdicionales?.trim() || '0'));
    for (const item of this.participants()) {
      const itemDiscount = D(item.amount).mul(quantity(item.quantity)).mul(discount);
      item.amount = D(item.amount).sub(itemDiscount).toFixed(); this.total = this.total.add(itemDiscount);
      for (const rawModifier of item.modifiers ?? []) {
        if (modifiers >= limit) break;
        const modifier = modifierValue(rawModifier);
        if (modifier.amount == null || D(modifier.amount).lte(0) || (modifier.quantity ?? 0) <= 0) continue;
        const applied = Math.min(modifier.quantity!, limit - modifiers);
        const modifierDiscount = D(modifier.amount).div(modifier.quantity!).toDecimalPlaces(2).mul(applied).mul(discount);
        modifier.amount = D(modifier.amount).sub(modifierDiscount).toFixed(); this.total = this.total.add(modifierDiscount); modifiers += applied;
      }
    }
    if (this.total.gt(this.maximum)) this.total = this.maximum.toDecimalPlaces(1);
  }
  amountDiscount(): void {
    const amount = couponAmount(this.coupon.cupon.fcValorCupon);
    const items = this.participants(); const participating = totalOrder(items);
    if (!items.length) return;
    let effective = Decimal.min(amount, participating);
    const available = this.coupon.cupon.fnMontoDisponible;
    if (available != null && D(available).gte(0)) effective = Decimal.min(effective, D(available));
    if (effective.lte(0) || participating.lte(0)) return;
    let applied = D(0);
    items.forEach((item, index) => {
      const discount = index === items.length - 1 ? effective.sub(applied) : effective.mul(D(item.amount ?? 0).mul(item.quantity ?? 0)).div(participating).toDecimalPlaces(2);
      applied = applied.add(discount);
      const perUnit = (item.quantity ?? 0) > 0 ? discount.div(item.quantity!).toDecimalPlaces(2) : discount;
      item.amount = D(item.amount).sub(perUnit).toFixed();
    });
    this.total = effective;
  }
  nxm(items: Item[]): void {
    const participants = items.filter(item => !item.descart).sort((a, b) => D(a.amount).cmp(D(b.amount)));
    const rules = this.extra.fcPromocionesNxM;
    if (!rules) throw legacyRuntime('nxmRulesNull');
    const additionalCount = javaDouble(this.extra.fcNumAdicionales);
    const sold = javaDouble(rules.fcNxMUnidadVendida); const paid = javaDouble(rules.fcNxMUnidadPromocionNArticulo);
    const repetitions = javaDouble(this.extra.fcNumArticulosPromocion); const max = sold * repetitions;
    const totalQuantity = participants.reduce((sum, item) => sum + quantity(item.quantity), 0);
    const promotionAmount = javaDouble(rules.fcNxMUnidadPromocionMonto);
    const count = totalQuantity > max ? Math.trunc(max / sold) * Math.trunc(sold - paid)
      : promotionAmount > 0 ? Math.trunc(sold) : Math.trunc(totalQuantity / sold) * Math.trunc(sold - paid);
    if (count <= 0) return;
    const expanded: Item[] = [];
    for (const item of participants) { for (let index = 0; index < quantity(item.quantity) && expanded.length < count; index++) expanded.push(item); if (expanded.length >= count) break; }
    if (promotionAmount > 0) this.total = this.total.add(promotionAmountDiscount(expanded, D(promotionAmount), count));
    else for (const item of expanded) this.total = this.total.add(D(item.amount));
    if (additionalCount > 0) {
      const modifiers = expanded[0]!.modifiers;
      if (modifiers == null) throw legacyRuntime('modifierListNull');
      let limit = Math.min(modifiers.length, additionalCount);
      for (const rawModifier of modifiers) if (limit > 0) {
        const modifier = modifierValue(rawModifier);
        if (D(modifier.amount).gt(0)) {
          const applied = Math.min(quantity(modifier.quantity), limit);
          this.total = this.total.add(D(modifier.amount).mul(applied)); limit -= applied;
        }
      }
    }
  }
}

function preconditions(request: ValidateRequest, coupon: ExternalCoupon, extra: Additional): void {
  for (const restriction of coupon.restricciones ?? []) if (restriction.fiTipoRestriccionID === 1) {
    if (request.totalOrder == null) throw technical('El total de la orden es requerido para validar el monto mínimo');
    const value = restriction.fcValor;
    if (value == null || value.trim() === '') throw technical('La restricción de monto mínimo no contiene un valor válido');
    let minimum: Decimal;
    try { minimum = D(value.trim()); } catch { throw technical(`El monto mínimo configurado no es válido: ${value}`); }
    if (D(request.totalOrder).lt(minimum)) throw technical(`El total de la orden es menor al monto mínimo requerido: ${minimum.toFixed()}`);
  }
  const levels = (extra.fcNivelesDePrecio ?? '').split(',').flatMap(value => {
    try { return [javaInteger(value.trim())]; } catch { return []; }
  });
  if (levels.length) for (const item of request.itemsOrder ?? []) {
    if (item === null) throw legacyRuntime('itemPriceLevelNull');
    if (item.priceLevel != null && !levels.includes(item.priceLevel)) {
      throw technical(`El nivel de precio recibido no cumple con la definición del cupón. Niveles permitidos: [${levels.join(', ')}]`);
    }
  }
}
export function evaluateDiscount(request: ValidateRequest, coupon: ExternalCoupon): Evaluation {
  const extra = additional(coupon.fcCampoAdicion2);
  preconditions(request, coupon, extra);
  const type = coupon.cupon.fiTipoPromocionID;
  const response: ValidateResult = {
    code: '000', couponType: type, totalDiscount: D(0), discountId: coupon.cupon.fcFolioCuponID,
    paymentMethodApply: integerList(extra.fcFPagoLigadaAdicional), binesList: binesList(extra.fcBines),
    nombreEmpleado: coupon.cupon.fcNombreEmpleado ?? '', restriction: '', message: 'OK.',
  };
  if (type === 7) return { result: null, rejectAfterSave: () => false };
  if (![1, 2, 3, 4, 5, 6].includes(type)) throw technical('Promotion type not supported: UNKNOWN');
  if (type === 2 && request.brandId === 60) {
    const rewards = extra.fcPromocionesSBXRload?.fcRewardsProducts;
    response.discountId = rewards?.includes(',') ? rewards.split(',')[0]!.trim() : rewards ?? null;
    response.couponType = 2; response.paymentMethodApply = []; response.code = request.couponCode;
    return { result: response, rejectAfterSave: () => false };
  }
  const calculation = new Calculation(request, coupon, extra);
  if (type === 3) couponAmount(coupon.cupon.fcValorCupon);
  if (type === 6 && extra.fcNumAdicionales?.trim()) {
    try { javaInteger(extra.fcNumAdicionales.trim()); } catch (cause) { throw technical('fcNumAdicionales debe ser un número entero válido', cause); }
  }
  // Los tipos 2 y 3 toleran una lista de artículos ausente; otros tipos no la toleran.
  const skipRestrictions = [2, 3].includes(type) && !request.itemsOrder?.length;
  const restrictions = skipRestrictions ? new Map<number, Item[]>() : calculation.restrictions();
  if (type === 3) {
    const original = request.itemsOrder;
    request.itemsOrder ??= [];
    calculation.amountDiscount();
    if (original == null) request.itemsOrder = original;
  } else if (type === 2) {
    response.discountId = coupon.cupon.fcValorCupon;
    for (const [kind] of restrictions) {
      if (kind === 5) response.restriction = coupon.cupon.fcValorCupon;
      if (kind === 1) calculation.minimumRestriction();
      if (kind === 4) calculation.maximumRestriction(calculation.total);
    }
  } else if (type === 5) {
    for (const [kind, items] of restrictions) {
      if (kind === 1) calculation.minimumRestriction();
      if (kind === 8 || kind === 9) calculation.nxm(items);
    }
  } else {
    const discount = D(coupon.cupon.fcValorCupon).div(100);
    const linked = restrictions.has(2) || restrictions.has(3);
    const primary = linked || restrictions.has(10);
    if (type === 1 && !coupon.restricciones?.length) calculation.total = D(request.totalOrder).mul(discount);
    for (const [kind] of restrictions) {
      if (kind === 3) calculation.linkedFamily(discount);
      if (kind === 2) calculation.linkedItem(discount);
      if (type !== 6 && kind === 10) calculation.excludedProducts(discount);
      if (type === 1 && kind === 1) calculation.minimumRestriction();
      if (kind === 4) {
        if (type === 4 || (type === 1 && !primary)) calculation.maximumRestriction(discount);
        if (type === 6 && !linked) calculation.employeeMaximum(discount);
      }
    }
    if (type === 1 && primary && restrictions.has(4)) calculation.total = Decimal.min(calculation.total, calculation.maximum.mul(discount));
    if (type === 6 && linked && restrictions.has(4)) calculation.total = Decimal.min(calculation.total, calculation.maximum);
  }
  if (![2, 3].includes(type) && request.itemsOrder == null) void calculation.items;
  response.totalDiscount = rounded(calculation.total, request.countryId);
  if (type === 4) {
    if (coupon.cupon.fnFormaPagoMarca == null) throw legacyRuntime('paymentMethodNull');
    response.discountId = String(coupon.cupon.fnFormaPagoMarca);
  }
  if (type === 6 && request.countryId === 3) response.paymentMethodApply = [4, 5, 6, 14, 20, 21, 26, 94, 1106, 9001, 1132, 1104, 1130];
  // El origen guarda la transacción antes de esta comprobación final.
  const rejectAfterSave = () => [2, 3].includes(type) ? !!request.itemsOrder?.length && calculation.items.every(item => item.descart)
    : calculation.items.every(item => item.descart);
  return { result: response, rejectAfterSave };
}
export function remapResult(result: ValidateResult, request: ValidateRequest, coupon: ExternalCoupon): void {
  const type = coupon.cupon.fiTipoPromocionID;
  const override = additional(coupon.fcCampoAdicion2).fcPromocionesSBXRload?.fcIDDiscount;
  result.couponType = request.brandId === 60 && [1, 2].includes(result.couponType) ? result.couponType
    : ({ 2: 1, 1: 3, 3: 3, 5: 3, 6: 8, 4: 9, 7: 11 } as Record<number, number>)[result.couponType] ?? 0;
  if (override?.trim()) result.discountId = override.trim();
  else if (request.brandId === 60) { if (type !== 2) result.discountId = ''; }
  else result.discountId = ({ 1: '7002', 3: '7001', 5: '7003', 6: '7004' } as Record<number, string>)[type] ?? result.discountId;
}
