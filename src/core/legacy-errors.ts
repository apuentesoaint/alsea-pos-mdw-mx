import { AppError } from './errors.js';

/** Mensajes ya reconstruidos del Java. La redacción NPE depende de bytecode/JVM;
 * centralizarlos no convierte su caracterización estática en certificación. */
export const legacyRuntimeMessages = Object.freeze({
  decimalNull: 'Cannot invoke "String.toCharArray()" because "val" is null',
  quantityNull: 'Cannot invoke "java.lang.Integer.intValue()" because the quantity is null',
  modifierNull: 'Cannot invoke "com.alsea.cupones.msadmincupon.dto.ModifierOrderDTO.getAmount()" because "modifier" is null',
  doubleNull: 'Cannot invoke "String.trim()" because "in" is null',
  itemAmountNull: 'Cannot invoke "com.alsea.cupones.msadmincupon.dto.ItemOrderDTO.getAmount()" because "item" is null',
  itemsNull: 'Cannot invoke "java.util.List.stream()" because the return value of "com.alsea.cupones.msadmincupon.dto.ValidateCouponDTO.getItemsOrder()" is null',
  itemDiscardNull: 'Cannot invoke "com.alsea.cupones.msadmincupon.dto.ItemOrderDTO.isDescart()" because "item" is null',
  restrictionsNull: 'Cannot invoke "java.util.List.iterator()" because "restrictions" is null',
  modifiersNull: 'Cannot invoke "java.util.List.iterator()" because the return value of "com.alsea.cupones.msadmincupon.dto.ItemOrderDTO.getModifiers()" is null',
  nxmRulesNull: 'Cannot invoke "com.alsea.cupones.msadmincupon.model.cuponvalidate.CampoAdicion2DTO$PromocionesNxMDTO.getFcNxMUnidadVendida()" because "promociones" is null',
  modifierListNull: 'Cannot invoke "java.util.List.size()" because the return value of "com.alsea.cupones.msadmincupon.dto.ItemOrderDTO.getModifiers()" is null',
  itemPriceLevelNull: 'Cannot invoke "com.alsea.cupones.msadmincupon.dto.ItemOrderDTO.getPriceLevel()" because "item" is null',
  paymentMethodNull: 'Cannot invoke "java.lang.Integer.toString()" because "methodPay" is null',
  transactionDiscountNull: 'Cannot invoke "java.math.BigDecimal.compareTo(java.math.BigDecimal)" because the return value of "com.alsea.cupones.msadmincupon.entities.TransaccionesDTO.getDiscount()" is null',
  couponIdNull: 'Cannot invoke "String.isEmpty()" because the return value of "com.alsea.cupones.msadmincupon.model.cuponredeem.CuponRedeemResp.getCouponId()" is null',
  employeeNull: 'Cannot invoke "java.lang.Integer.intValue()" because the return value of "com.alsea.cupones.msadmincupon.entities.TransaccionesDTO.getEmployeeId()" is null',
});
export type LegacyRuntimeCode = keyof typeof legacyRuntimeMessages;
export class LegacyRuntimeError extends AppError {
  constructor(readonly code: LegacyRuntimeCode) {
    super('technical', legacyRuntimeMessages[code]); this.name = 'LegacyRuntimeError';
  }
}
export const legacyRuntime = (code: LegacyRuntimeCode) => new LegacyRuntimeError(code);
