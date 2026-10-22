export const messages = Object.freeze({
  server: 'No fue posible completar su solicitud. ',
  provider: 'No fue posible completar la solicitud con el servicio de cuponera. ',
  general: 'Se produjo una excepción. ',
  json: 'El JSON de la solicitud es incorrecto. Por favor valida la estructura e intenta nuevamente.',
  notValidated: 'No se encontraron resultados. No se realizó validación de la solicitud. ',
  discountMismatch: 'No se encontraron resultados. La cantidad del descuento no coincide. ',
});
export class AppError extends Error {
  constructor(public readonly kind: 'validation' | 'business' | 'technical' | 'persistence' | 'authentication', message: string, options?: ErrorOptions) {
    super(message, options); this.name = `${kind}Error`;
  }
}
export const technical = (message: string, cause?: unknown) => new AppError('technical', message, { cause });
export const business = (message: string) => new AppError('business', message);
export const persistence = (cause: unknown) => new AppError('persistence', messages.server, { cause });
export function publicError(error: unknown): { status: number; message: string } {
  if (error instanceof AppError) {
    if (error.kind === 'authentication') return { status: 401, message: '' };
    if (error.kind === 'persistence') return { status: 500, message: messages.server };
    let message = error.message;
    if (['i/o error on', 'cupones.alsea.com.mx', 'wscupones', 'server returned http response code'].some(value => message.toLowerCase().includes(value))) message = messages.provider;
    return { status: 400, message };
  }
  return { status: 500, message: messages.server };
}
