const integer = { type: 'integer', format: 'int32' };
const string = { type: 'string' };
const amount = { type: 'number' };
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const list = (name: string) => ({ type: 'array', items: ref(name) });
const common = { countryId: integer, brandId: integer, storeId: integer, couponCode: { type: 'string', minLength: 1, maxLength: 10 }, typeOrder: { type: 'string', minLength: 1, maxLength: 10 } };
export function openapi() {
  const schemas = {
    JwtTokenDTO: { type: 'object', required: ['clientId', 'clientSecret'], properties: { clientId: string, clientSecret: string } },
    JwtRespModel: { type: 'object', properties: { tokenType: string, accessToken: string, expiresIn: string } },
    ValidateCouponDTO: { type: 'object', required: [...Object.keys(common), 'posId', 'orderNumber', 'totalOrder'], properties: {
      ...common, posId: integer, orderNumber: integer, totalOrder: amount, itemsOrder: list('ItemOrderDTO'), comboOrder: list('ComboOrderDTO'),
    } },
    RedeemCouponDTO: { type: 'object', required: [...Object.keys(common), 'posID', 'paymentMethodId', 'totalOrderWithOutDiscount', 'totalOrder', 'totalDiscountOrder', 'ticketId', 'fechaCanje', 'uid'], properties: {
      ...common, posID: string, paymentMethodId: string, totalOrderWithOutDiscount: amount, totalOrder: amount, totalDiscountOrder: amount,
      employeID: integer, ticketId: string, fechaCanje: string, nombreColaborador: string, uid: string,
    } },
    ItemOrderDTO: { type: 'object', properties: { idItem: integer, typeItem: integer, nameItem: string, familyId: integer, quantity: integer, amount, comment: string,
      modifiers: list('ModifierOrderDTO'), descart: { type: 'boolean' }, multivalue: { type: 'boolean' }, priceLevel: integer } },
    ModifierOrderDTO: { type: 'object', properties: { modifierId: integer, modifierName: string, familyId: integer, quantity: integer, amount, comment: string, modifiers: list('ModifierOrderDTO') } },
    ComboOrderDTO: { type: 'object', properties: { comboId: integer, itemId: integer, comboName: string, familyId: integer, quantity: integer, amount, comboItems: list('ItemOrderDTO') } },
    GenerateCouponRequestDTO: { type: 'object', required: ['request', 'customer'], properties: { request: ref('RequestData'), customer: ref('CustomerData') } },
    RequestData: { type: 'object', required: ['campaign_id', 'coupon_type', 'broadcast_channel', 'brandId', 'countryId'], properties: { campaign_id: string, coupon_type: integer, broadcast_channel: string, brandId: integer, countryId: integer } },
    CustomerData: { type: 'object', required: ['id', 'name'], properties: { id: string, name: string, phoneCode: string, phone: string } },
    GenerateCouponResponseDTO: { type: 'object', properties: { coupon: ref('CouponData') } },
    CouponData: { type: 'object', properties: { code: string } },
    ValidateRespModel: { type: 'object', properties: { code: string, couponType: integer, totalDiscount: amount, discountId: string, paymentMethodApply: { type: 'array', items: integer },
      binesList: { type: 'array', items: integer }, nombreEmpleado: string, restriction: string, message: string } },
    RedeemRespModel: { type: 'object', properties: { code: string } },
    TransactionStatusDTO: { type: 'object', properties: { uid: string, redeemed: { type: 'boolean' } } },
    StoreDTO: { type: 'object', required: ['countryId', 'brandId', 'storeId'], properties: { countryId: integer, brandId: integer, storeId: integer, name: string, active: { type: 'boolean' } } },
    ApiResponseDTO: { type: 'object', properties: { uid: { ...string, nullable: true }, timestamp: string, status: integer, type: string, message: string, helpUrl: string,
      success: { type: 'boolean' }, data: { nullable: true } } },
  };
  const request = (schema: string) => ({ required: true, content: { 'application/json': { schema: ref(schema) } } });
  const response = (schema: string) => ({ description: 'Respuesta del servicio', content: { 'application/json': { schema: ref(schema) } } });
  const coupon = (schema: string, data: string) => ({ tags: ['Cupon'], security: [{ bearerToken: [] }], requestBody: request(schema),
    responses: { '200': { ...response('ApiResponseDTO'), content: { 'application/json': { schema: { allOf: [ref('ApiResponseDTO'), { properties: { data: ref(data) } }] } } } }, '400': response('ApiResponseDTO'), '500': response('ApiResponseDTO') } });
  return {
    openapi: '3.0.1', info: { title: 'Cuponera API', version: '1.0.5', description: 'This API exposes endpoints to coupons Alsea.',
      termsOfService: 'https://www.alsea.com/terms', contact: { name: 'Alsea SA', email: 'alsea@gmail.com', url: 'https://www.alsea.com' }, license: { name: 'MIT License', url: 'https://choosealicense.com/licenses/mit/' } },
    servers: [{ url: process.env.OPENAPI_DEV_URL ?? 'http://localhost:8080', description: 'Server URL in Development environment' },
      { url: process.env.OPENAPI_PROD_URL ?? 'https://alsea-api.com', description: 'Server URL in Production environment' }],
    paths: {
      '/auth/token': { post: { operationId: 'createToken', requestBody: request('JwtTokenDTO'), responses: { '200': response('JwtRespModel'), '401': { description: 'No autorizado' } } } },
      '/coupons/healthcheck': { get: { operationId: 'healt', tags: ['Cupon'], responses: { '200': { description: 'HealthCheck exitoso', content: { 'application/json': { schema: string } } } } } },
      '/coupons/validate': { post: { operationId: 'validateCoupon', ...coupon('ValidateCouponDTO', 'ValidateRespModel') } },
      '/coupons/redeem': { post: { operationId: 'redeemCoupon', ...coupon('RedeemCouponDTO', 'RedeemRespModel') } },
      '/coupons/generate': { post: { operationId: 'generateCoupon', ...coupon('GenerateCouponRequestDTO', 'GenerateCouponResponseDTO') } },
      '/coupons/pos/store': { post: { operationId: 'saveStore', tags: ['POS'], security: [{ bearerToken: [] }], requestBody: request('StoreDTO'), responses: { '200': response('ApiResponseDTO'), '400': response('ApiResponseDTO'), '401': { description: 'No autorizado' } } } },
      '/coupons/transaction/latest': { get: { operationId: 'getLatestTransaction', tags: ['Cupon'], security: [{ bearerToken: [] }],
        parameters: ['countryId', 'brandId', 'storeId', 'couponCode'].map(name => ({ name, in: 'query', required: true, schema: name === 'couponCode' ? string : integer })), responses: { '200': response('ApiResponseDTO') } } },
      '/test-insights': { get: { operationId: 'testInsights', security: [{ bearerToken: [] }], responses: { '200': { description: 'Evento de telemetría', content: { '*/*': { schema: string } } } } } },
    },
    components: { securitySchemes: { bearerToken: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } }, schemas },
  };
}
