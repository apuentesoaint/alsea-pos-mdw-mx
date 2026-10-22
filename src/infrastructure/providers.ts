import { createHash } from 'node:crypto';
import type { Config } from '../core/config.js';
import type { CouponProvider, ExternalCoupon, GenerateRequest, RedeemRequest, SecretReader, Transaction, ValidateRequest } from '../core/types.js';
import { messages, technical } from '../core/errors.js';
import { stringify } from '../core/json.js';
import { metric } from '../core/logging.js';
import { ExternalHttpError, externalJson, type HttpTransport } from './http.js';
import { javaInteger } from '../core/validation.js';

type AccessToken = { value: string; expires: number };
function objectFields(value: unknown, allowed: string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new SyntaxError('Respuesta no compatible con el DTO Java');
  const object = value as Record<string, unknown>;
  for (const field of allowed) if (!(field in object)) object[field] = null;
  return object;
}
function externalString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'object') throw new SyntaxError('Texto externo inválido');
  return String(value);
}
function externalInteger(value: unknown): number | null {
  if (value == null || typeof value === 'string' && ['', 'null'].includes(value.trim())) return null;
  if (typeof value === 'string') return javaInteger(value.trim());
  if (typeof value !== 'number' || !Number.isFinite(value) || value < -2147483648 || value > 2147483647) throw new SyntaxError('Entero externo inválido');
  return Math.trunc(value);
}
function externalCoupon(text: string): ExternalCoupon {
  const value = objectFields(externalJson(text), ['fcUID', 'fcTokenRedencion', 'cupon', 'restricciones', 'fcCampoAdicion1', 'fcCampoAdicion2']);
  const strings = ['fcUID', 'fcTokenRedencion', 'fcCampoAdicion1', 'fcCampoAdicion2'];
  for (const key of strings) value[key] = externalString(value[key]);
  if (value.cupon != null) {
    const coupon = objectFields(value.cupon, ['fcFolioCuponID', 'fiTipoPromocionID', 'fiTipoCuponID', 'fcTipoCuponDesc', 'fnFormaPagoMarca', 'fcValorCupon', 'fcNombreEmpleado', 'fnMontoDisponible', 'fiContieneCuponLigado']);
    for (const key of ['fiTipoPromocionID', 'fiTipoCuponID', 'fnFormaPagoMarca', 'fiContieneCuponLigado']) coupon[key] = externalInteger(coupon[key]);
    for (const key of ['fcFolioCuponID', 'fcTipoCuponDesc', 'fcValorCupon', 'fcNombreEmpleado']) coupon[key] = externalString(coupon[key]);
    if (coupon.fnMontoDisponible != null) {
      if (!['number', 'string'].includes(typeof coupon.fnMontoDisponible) || !Number.isFinite(Number(coupon.fnMontoDisponible))) throw new SyntaxError('Monto externo inválido');
      coupon.fnMontoDisponible = Number(coupon.fnMontoDisponible);
    }
  }
  if (value.restricciones != null) {
    if (!Array.isArray(value.restricciones)) throw new SyntaxError('Restricciones externas inválidas');
    for (const item of value.restricciones) {
      const restriction = objectFields(item, ['fiTipoRestriccionID', 'fiMultivalor', 'fcValor']);
      for (const key of ['fiTipoRestriccionID', 'fiMultivalor']) restriction[key] = externalInteger(restriction[key]);
      restriction.fcValor = externalString(restriction.fcValor);
    }
  }
  return value as unknown as ExternalCoupon;
}
export class DigitalCoupons implements CouponProvider {
  private cuponera?: AccessToken;
  private starbucks?: AccessToken;
  private cuponeraPending?: Promise<string>;
  private starbucksPending?: Promise<string>;
  constructor(private readonly config: Config, private readonly secrets: SecretReader, private readonly http: HttpTransport, private readonly now = () => Date.now()) {}
  private async token(): Promise<string> {
    if (this.cuponera && this.cuponera.expires >= this.now()) return this.cuponera.value;
    if (this.cuponeraPending) return this.cuponeraPending;
    this.cuponeraPending = (async () => {
      const credential = await this.secrets.get(this.config.cuponeraSecret);
      if (typeof credential.basic !== 'string' || !credential.basic) throw new Error('Credencial Cuponera no configurada');
      const url = new URL(this.config.tokenUrl); url.searchParams.append('grant_type', 'client_credentials');
      const response = await this.http(url.toString(), { method: 'POST', headers: { Authorization: `Basic ${credential.basic}`, 'Content-Type': 'application/json' } }, 'cuponera', 'token');
      if (response.status !== 200) throw technical(`Error al obtener el token: ${response.status}`);
      const body = externalJson<{ access_token: string; expires_in: number }>(response.text);
      if (typeof body.access_token !== 'string' || !Number.isFinite(Number(body.expires_in))) throw technical(messages.general);
      this.cuponera = { value: body.access_token, expires: (Math.floor(this.now() / 1000) + Number(body.expires_in)) * 1000 };
      return body.access_token;
    })();
    try { return await this.cuponeraPending; } finally { this.cuponeraPending = undefined; }
  }
  private async sbxToken(): Promise<string> {
    if (this.starbucks && this.now() <= this.starbucks.expires - 300_000) return this.starbucks.value;
    if (this.starbucksPending) return this.starbucksPending;
    this.starbucksPending = (async () => {
      const credentials = await this.secrets.get(this.config.starbucksSecret);
      if (typeof credentials.clientId !== 'string' || typeof credentials.clientSecret !== 'string') throw new Error('Credenciales Starbucks no configuradas');
      const timestamp = String(Math.floor(this.now() / 1000));
      const sig = createHash('sha256').update(credentials.clientId + credentials.clientSecret + timestamp).digest('hex');
      const url = this.config.starbucksUrl + this.config.starbucksVersion + this.config.starbucksTokenPath;
      const response = await this.http(url, { method: 'POST', headers: {
        'Content-Type': 'application/json', 'x-api-key': credentials.clientId, 'client-secret': credentials.clientSecret,
        'grant-type': 'client_credentials', timestamp, sig, 'user-agent': 'corealsea',
      }, body: '{"": ["{}"]}' }, 'starbucks', 'token');
      const body = externalJson<{ access_token: string; expires_in: number }>(response.text);
      if (!body.access_token) throw technical('Failed to obtain access token from Starbucks API');
      this.starbucks = { value: body.access_token, expires: this.now() + Number(body.expires_in) * 1000 };
      return body.access_token;
    })();
    // El Java envuelve los errores del endpoint token: solo el GET de cupón reintenta un 401.
    try { return await this.starbucksPending; }
    catch (cause) { throw new Error('Error getting Starbucks access token', { cause }); }
    finally { this.starbucksPending = undefined; }
  }
  private async sbxCoupon(code: string): Promise<string | null> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const token = await this.sbxToken();
        const response = await this.http(this.config.starbucksUrl + this.config.starbucksVersion + this.config.starbucksCouponPath, {
          method: 'GET', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`,
            'user-agent': 'corealsea', Accept: 'application/json', source: 'middleware', folio: code },
        }, 'starbucks', 'validate');
        if (response.status !== 200) return null;
        try {
          const body = externalJson<{ FolioCupon1?: unknown }>(response.text);
          const folio = body.FolioCupon1 == null || typeof body.FolioCupon1 === 'object' ? null : String(body.FolioCupon1);
          return folio?.trim() ? folio : null;
        } catch { return null; }
      } catch (error) {
        if (error instanceof ExternalHttpError && error.status === 401) {
          this.starbucks = undefined;
          if (attempt === 0) continue;
        }
        return null;
      }
    }
    return null;
  }
  async validate(request: ValidateRequest, uid: string): Promise<ExternalCoupon> {
    if (request.brandId === 10) request.couponCode = await this.sbxCoupon(request.couponCode) as string;
    const token = await this.token();
    const url = new URL(this.config.validateUrl + (request.couponCode ?? 'null'));
    url.searchParams.append('fiPaisID', String(request.countryId)); url.searchParams.append('fiMarcaID', String(request.brandId)); url.searchParams.append('fiTiendaID', String(request.storeId));
    try {
      const response = await this.http(url.toString(), { method: 'GET', headers: { timeZone: request.countryId === 3 ? '-3' : '-6', Authorization: `Bearer ${token}` } }, 'cuponera', 'validate');
      if (response.status !== 200) throw technical(messages.general);
      let result: ExternalCoupon;
      // El catch externo del Java convierte también los fallos de mapeo a GENERAL_MSG_ERROR.
      try { result = externalCoupon(response.text); } catch (cause) { throw technical(messages.general, cause); }
      if (result != null && !result.fcUID?.trim()) result.fcUID = uid;
      return result;
    } catch (error) {
      if (error instanceof ExternalHttpError && error.status >= 400 && error.status < 500) {
        try { const body = externalJson<Record<string, unknown>>(error.text); throw technical(String(body.consumerMessage ?? 'null')); }
        catch (cause) { if (cause instanceof SyntaxError) throw technical(messages.general); throw cause; }
      }
      if (error instanceof ExternalHttpError) throw technical(error.message, error);
      if (error instanceof TypeError || (error instanceof Error && error.name === 'TimeoutError')) throw technical(messages.provider, error);
      throw error;
    }
  }
  async redeem(request: RedeemRequest, transaction: Transaction): Promise<{ folioCuponId: string | null }> {
    // El Java llama a Starbucks para todas las marcas en redeem, sin condicional.
    request.couponCode = await this.sbxCoupon(request.couponCode) as string;
    const payload = {
      folioCuponId: request.couponCode, paisId: String(request.countryId), marcaId: String(request.brandId), tiendaId: String(request.storeId),
      usuarioTienda: request.employeID ?? null, estacionTrabajo: '', ticketId: javaInteger(request.ticketId), montoTotalVenta: String(request.totalOrder),
      emailCliente: '', tokenRedencion: transaction.redemptionToken, fechaCanje: request.fechaCanje, nombreColaborador: request.nombreColaborador ?? null,
      campoAdicion1: `{"valorDescuento":${request.totalDiscountOrder},"montoTotalSinDescuento":${request.totalOrderWithOutDiscount}}`, campoAdicion2: '',
    };
    const token = await this.token();
    try {
      const response = await this.http(this.config.redeemUrl, { method: 'POST', headers: { 'Content-Type': 'application/json',
        timeZone: request.countryId === 3 ? '-4' : '-6', Authorization: `Bearer ${token}` }, body: stringify(payload) }, 'cuponera', 'redeem');
      if (![200, 201].includes(response.status)) throw technical('Error al procesar la solicitud HTTP');
      try {
        const value = objectFields(externalJson(response.text), ['folioCuponLigadoId', 'marcaId', 'paisId', 'folioCuponId', 'leyendaCuponLigado', 'tiendaId', 'campoAdicion1', 'campoAdicion2', 'promocionId', 'idUsuario']);
        return { folioCuponId: value.folioCuponId == null ? null : String(value.folioCuponId) };
      } catch (cause) { throw technical('Error al mapear la respuesta JSON a CuponRedeemResp', cause); }
    } catch (error) {
      if (error instanceof ExternalHttpError || error instanceof TypeError || (error instanceof Error && error.name === 'TimeoutError')) throw technical(messages.provider, error);
      throw error;
    }
  }
  async generate(request: GenerateRequest): Promise<{ coupon: { code: string } }> {
    const type = request.request.coupon_type;
    const supported = () => { if (![1, 2].includes(type)) throw technical(`coupon_type no soportado: ${type}`); };
    if (this.config.generateMock) {
      supported();
      metric('MockGenerations');
      return { coupon: { code: type === 1 ? 'MXSJH00981' : 'MXSJH00982' } };
    }
    try {
      const token = await this.token();
      supported();
      const payload = { fcSocioID: request.customer.id, cuponReq: { fcCampanaID: this.config.campaign,
        fcPromocionID: type === 1 ? this.config.promotionOne : this.config.promotionTwo, fiPaisID: request.request.countryId } };
      const response = await this.http(this.config.generateUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', timeZone: '-6', Authorization: `Bearer ${token}` }, body: stringify(payload) }, 'cuponera', 'generate');
      if (response.status < 200 || response.status >= 300 || !response.text) throw technical('Error al generar cupón en servicio externo');
      let body: unknown;
      try { body = externalJson(response.text); } catch (cause) { throw technical('Error al mapear la respuesta JSON a GenerateCouponResponseDTO', cause); }
      const value = body != null && typeof body === 'object' ? (body as Record<string, unknown>).fcFolioCuponID : undefined;
      const folio = value == null ? null : typeof value === 'object' ? '' : String(value);
      if (!folio?.trim()) throw technical('La respuesta del servicio externo no contiene fcFolioCuponID');
      return { coupon: { code: folio } };
    } catch (error) {
      if (error instanceof ExternalHttpError && error.status < 500) throw technical(`Error al generar cupón: ${error.text}`, error);
      if (error instanceof Error && error.name === 'technicalError') throw error;
      throw technical('Error al consumir el servicio de generación de cupones', error);
    }
  }
}
