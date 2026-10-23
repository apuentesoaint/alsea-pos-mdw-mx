import { createReadStream } from 'node:fs';
import { open, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { createHmac, randomBytes } from 'node:crypto';
import sql from 'mssql';
import { readPrivateJson } from './private-json.js';
import { validateSqlConfiguration } from './sql-configuration.js';
import { DynamoTransactions } from '../src/infrastructure/repository.js';
import type { Transaction } from '../src/core/types.js';
import { mapSql, validateTransaction } from './migration-model.js';

const { values } = parseArgs({ options: { file: { type: 'string' }, 'sql-config': { type: 'string' }, export: { type: 'string' }, apply: { type: 'boolean', default: false },
  reconcile: { type: 'boolean', default: false }, 'writes-stopped': { type: 'boolean', default: false }, 'sql-time-zone': { type: 'string', default: 'America/Mexico_City' } } });
if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('Se requiere Node.js 24');
if (values.apply && !values['writes-stopped']) throw new Error('El corte requiere --writes-stopped después de detener escrituras del Java');
if ((values.apply || values.reconcile) && (!process.env.TRANSACTIONS_TABLE || !process.env.DETAILS_BUCKET)) throw new Error('Configurar TRANSACTIONS_TABLE y DETAILS_BUCKET');
const repository = new DynamoTransactions(process.env.TRANSACTIONS_TABLE ?? '', process.env.DETAILS_BUCKET ?? '');
const digestKey = randomBytes(32); // Evita publicar hashes estables de tokens y datos personales.
let count = 0; let mismatch = 0;
const seen = new Set<string>();
const digest = (value: unknown) => createHmac('sha256', digestKey).update(JSON.stringify(value)).digest('hex');
async function consume(transaction: Transaction): Promise<void> {
  validateTransaction(transaction);
  const key = `${transaction.uid}\u0000${transaction.branchId}`;
  if (seen.has(key)) throw new Error('UID y sucursal duplicados; revisar origen antes de importar');
  seen.add(key);
  if (values.apply) {
    // Reanudación: nunca sobrescribir datos diferentes ni aplicar un canje de nuevo.
    const existing = await repository.get(transaction.uid, transaction.branchId);
    if (existing) {
      const fields = Object.keys(transaction).filter(field => field !== 'version') as (keyof Transaction)[];
      if (fields.some(field => digest(existing[field]) !== digest(transaction[field]))) throw new Error('Datos de destino diferentes; detener y conciliar');
    } else await repository.save(transaction);
  }
  if (values.reconcile) {
    const existing = await repository.get(transaction.uid, transaction.branchId);
    if (!existing || Object.keys(transaction).some(field => field !== 'version' && digest(existing[field as keyof Transaction]) !== digest(transaction[field as keyof Transaction]))) mismatch++;
  }
  count++;
}
async function main(): Promise<void> {
  if (values.file && values['sql-config']) throw new Error('Indicar solo una fuente: --file o --sql-config');
  if (values.file && values.export) throw new Error('--export requiere --sql-config');
  if (values.file) {
    const lines = createInterface({ input: createReadStream(values.file), crlfDelay: Infinity });
    for await (const line of lines) if (line.trim()) await consume(JSON.parse(line) as Transaction);
  } else {
    if (!values['sql-config']) throw new Error('Indicar --file o --sql-config; el secreto único de la API no contiene conexión SQL');
    const secret = await readPrivateJson(values['sql-config']);
    validateSqlConfiguration(secret);
    const pool = await new sql.ConnectionPool({ server: String(secret.host), database: String(secret.dbname), user: String(secret.username), password: String(secret.password),
      port: Number(secret.port ?? 1433), pool: { max: 2, min: 0 }, options: { encrypt: true, trustServerCertificate: false, useUTC: true } }).connect();
    let output: Awaited<ReturnType<typeof open>> | undefined;
    try {
      if (values.export) { await mkdir(dirname(values.export), { recursive: true }); output = await open(values.export, 'wx', 0o600); }
      let afterUid = ''; let afterBranch = -1;
      for (;;) {
        const rows = await pool.request().input('uid', sql.NVarChar, afterUid).input('branch', sql.Int, afterBranch)
          // CAST en SQL evita que el driver convierta DECIMAL a Number antes del mapeo.
          .query<Record<string, unknown>>(`SELECT TOP (500) FIUID, FIPAISID, FIMARCAID, FISUCURSALID, FITICKETID, FITIPOORDENID, FIMETODOPAGOID,
            FIEMPLEADOID, FCFOLIOCUPONID, FCORDERNUM, FCTOKENREDENCION, FCITEMREQUEST,
            CONVERT(varchar(33), FDFECHAVALIDATE, 126) AS FDFECHAVALIDATE,
            CONVERT(varchar(33), FDFECHAREDEEM, 126) AS FDFECHAREDEEM,
            CONVERT(varchar(100), FNMONTOTOTALSINDESCUENTO) AS FNMONTOTOTALSINDESCUENTO,
            CONVERT(varchar(100), FNMONTOTOTAL) AS FNMONTOTOTAL, CONVERT(varchar(100), FNDESCUENTO) AS FNDESCUENTO
            FROM TATRANSACCIONES WHERE FIUID > @uid OR (FIUID = @uid AND FISUCURSALID > @branch) ORDER BY FIUID, FISUCURSALID`);
        if (!rows.recordset.length) break;
        for (const row of rows.recordset) {
          const payments = await pool.request().input('uid', sql.NVarChar, String(row.FIUID))
            .query<{ FIMETODOPAGOID: number }>('SELECT FIMETODOPAGOID FROM TAPAGOTRANSACCIONES WHERE FIUID = @uid');
          const transaction = mapSql(row, payments.recordset.map(value => value.FIMETODOPAGOID), values['sql-time-zone']!);
          if (output) await output.write(`${JSON.stringify(transaction)}\n`);
          await consume(transaction);
          afterUid = String(row.FIUID); afterBranch = Number(row.FISUCURSALID);
        }
      }
    } finally { await output?.close(); await pool.close(); }
  }
  console.info(JSON.stringify({ mode: values.apply ? 'apply' : values.reconcile ? 'reconcile' : 'dry-run', count, mismatch }));
  if (mismatch) process.exitCode = 1;
}
try { await main(); } catch { console.error(JSON.stringify({ event: 'migration.failed', message: 'Migración detenida; revisar conectividad, esquema y conciliación sin registrar filas ni secretos.' })); process.exitCode = 1; }
