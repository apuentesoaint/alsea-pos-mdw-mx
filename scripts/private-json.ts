import { constants } from 'node:fs';
import { open } from 'node:fs/promises';

/** Comprueba y lee el mismo descriptor; no incluye contenido ni rutas en errores. */
export async function readPrivateJson(path: string): Promise<unknown> {
  try {
    // Evita bloquear al abrir una FIFO antes de poder comprobar su tipo.
    const file = await open(path, constants.O_RDONLY | (constants.O_NONBLOCK ?? 0));
    try {
      const metadata = await file.stat();
      if (!metadata.isFile()) throw new Error('Se requiere un archivo regular');
      if (process.platform !== 'win32' && (metadata.mode & 0o077) !== 0) throw new Error('Se requieren permisos privados');
      return JSON.parse(await file.readFile('utf8')) as unknown;
    } finally { await file.close(); }
  } catch { throw new Error('No fue posible leer el JSON privado; revisar archivo, permisos y formato'); }
}
