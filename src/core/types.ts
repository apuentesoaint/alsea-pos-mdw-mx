export type Numeric = string | number;
export interface Modifier {
  modifierId?: number | null; modifierName?: string | null; familyId?: number;
  quantity?: number | null; amount?: Numeric | null; comment?: string | null;
  modifiers?: (Modifier | null)[] | null;
}
export interface Item {
  idItem: number | null; typeItem?: number | null; nameItem?: string | null; familyId: number | null;
  quantity: number | null; amount: Numeric | null; comment?: string | null; modifiers?: (Modifier | null)[] | null;
  descart?: boolean; multivalue?: boolean; priceLevel?: number | null;
}
export interface ValidateRequest {
  countryId: number; brandId: number; storeId: number; posId: number; orderNumber: number;
  couponCode: string; typeOrder: string; totalOrder: Numeric;
  itemsOrder?: (Item | null)[] | null; comboOrder?: unknown[] | null;
}
export interface RedeemRequest {
  countryId: number; brandId: number; storeId: number; posID: string;
  couponCode: string; typeOrder: string; paymentMethodId: string;
  totalOrderWithOutDiscount: Numeric; totalOrder: Numeric; totalDiscountOrder: Numeric;
  employeID?: number | null; ticketId: string; fechaCanje: string;
  nombreColaborador?: string | null; uid: string;
}
export interface GenerateRequest {
  request: { campaign_id: string; coupon_type: number; broadcast_channel: string; brandId: number; countryId: number };
  customer: { id: string; name: string; phoneCode?: string | null; phone?: string | null };
}
export interface StoreRequest {
  countryId: number;
  brandId: number;
  storeId: number;
  name?: string | null;
  posList?: (number | string)[] | null;
  active?: boolean | null;
  metadata?: Record<string, unknown> | null;
  [key: string]: unknown;
}
export interface ExternalCoupon {
  fcUID?: string | null; fcTokenRedencion: string | null;
  cupon: {
    fcFolioCuponID: string | null; fiTipoPromocionID: number; fiTipoCuponID?: number;
    fcTipoCuponDesc?: string; fnFormaPagoMarca?: number | null; fcValorCupon: string | null;
    fcNombreEmpleado?: string | null; fnMontoDisponible?: Numeric | null;
    fiContieneCuponLigado?: number | null;
  };
  restricciones: { fiTipoRestriccionID: number; fiMultivalor?: number | null; fcValor: string }[] | null;
  fcCampoAdicion1?: string | null; fcCampoAdicion2?: string | null;
}
export interface Additional {
  fcFPagoLigadaAdicional?: string | null; fcBines?: string | null;
  fcNivelesDePrecio?: string | null; fcNumAdicionales?: string | null; fcNumArticulosPromocion?: string | null;
  fcPromocionesNxM?: { fcNxMUnidadVendida: string; fcNxMUnidadPromocionNArticulo: string;
    fcNxMUnidadPromocionMonto: string; fcNxMIndicadorPromocion?: string } | null;
  fcPromocionesSBXRload?: { fcRewardsProducts?: string | null; fcIDDiscount?: string | null;
    fcBanderaRload?: string; fcMontoPagoRload?: string; fcMontoRegaloRload?: string } | null;
}
export interface ValidateResult {
  code: string; couponType: number; totalDiscount: Numeric | object; discountId: string | null;
  paymentMethodApply: number[]; binesList: number[]; nombreEmpleado: string;
  restriction: string | null; message: string;
}
export interface Transaction {
  uid: string; countryId: number | null; brandId: number | null; branchId: number;
  ticketId: number | null; orderTypeId: number | null; paymentMethodId: number | null; employeeId: number | null;
  couponFolio: string | null; orderNumber: string | null; redemptionToken: string | null; itemRequest: string | null;
  totalAmountWithoutDiscount: string | null; totalAmount: string | null; discount: string | null;
  validationDate: string | null; redemptionDate: string | null; payments: number[]; version: number;
}
export interface TransactionRepository {
  save(transaction: Transaction): Promise<void>;
  get(uid: string, branchId: number): Promise<Transaction | undefined>;
  latest(countryId: number, brandId: number, branchId: number, couponCode: string): Promise<Pick<Transaction, 'uid' | 'redemptionDate'> | undefined>;
  redeem(transaction: Transaction, request: RedeemRequest): Promise<void>;
  attempt(uid: string, branchId: number, requestId: string, state: 'started' | 'external-success' | 'committed' | 'uncertain'): Promise<void>;
  saveStore(store: StoreRequest): Promise<{ storeKey: string }>;
}
export interface CouponProvider {
  validate(request: ValidateRequest, uid: string): Promise<ExternalCoupon>;
  redeem(request: RedeemRequest, transaction: Transaction): Promise<{ folioCuponId: string | null }>;
  generate(request: GenerateRequest): Promise<{ coupon: { code: string } }>;
}
export interface SecretReader { get<T extends Record<string, unknown>>(id: string): Promise<T> }
