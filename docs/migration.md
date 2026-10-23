# Migración y corte

Confirmar exportación autorizada, uso exclusivo de tablas, zona de datetime SQL, intercalación, unicidad y cuenta AWS. No se mantiene doble escritura ni convivencia prolongada.

El importador es Node.js 24/ESM/SDK v3; el controlador SQL es exclusivo del operador y no entra en los ZIP Lambda. Adjuntar MigrationPolicyArn a un rol temporal; no se adjunta automáticamente a una identidad. El usuario SQL solo necesita lectura.

Configurar TRANSACTIONS_TABLE, DETAILS_BUCKET, región y perfil temporal por canal seguro. La extracción SQL recibe `--sql-config /ruta/privada/sql.json`: archivo fuera del repositorio, con permisos 600 y campos host, username, password, dbname y port opcional (1–65535). El secreto único de la API no contiene conexión SQL; el importador ya no consulta Secrets Manager. La importación por `--file` continúa disponible. Los archivos exportados contienen datos sensibles: conservarlos fuera del repositorio, con acceso restringido y cifrado. migration-data está ignorado; las exportaciones nuevas tienen permisos 600 y no se sobrescriben.

```sh
# Exportar/comprobar; no escribe DynamoDB.
npm run migrate -- --sql-config /ruta/privada/sql.json --export /ruta/privada/transactions.jsonl --sql-time-zone America/Mexico_City

# Comprobar archivo sin contactar SQL ni escribir DynamoDB.
npm run migrate -- --file /ruta/privada/transactions.jsonl

# Solo después de detener escrituras y drenar solicitudes.
npm run migrate -- --file /ruta/privada/transactions.jsonl --apply --writes-stopped

# Comparar campos y pagos de destino contra exportación.
npm run migrate -- --file /ruta/privada/transactions.jsonl --reconcile
```

No combinar --file con --sql-config ni --file con --export; las opciones ambiguas se rechazan antes de leer o consultar la fuente. Los archivos de configuración se comprueban y leen por el mismo descriptor y deben ser regulares, sin permisos de grupo/otros en POSIX. Windows requiere ACL privadas administradas por el operador.

La extracción pagina por UID/sucursal en lotes de 500. Pagos se consultan por UID y conservan duplicados; el origen no identifica una columna de orden.

Se conservan UID, marca almacenada, folio, token de redención, importes y fechas. No normalizar marca 20 → 60 en históricos. --sql-time-zone interpreta datetime sin zona: México es un valor inicial que debe confirmarse, no una detección automática.

La consulta convierte DECIMAL y fechas a texto antes de pasar por el driver, evitando pérdida de precisión. Se preservan NULL históricos y hasta nueve cifras fraccionarias de Timestamp; las claves de pendientes normalizan la precisión para ordenar instantes correctamente. Un UID o sucursal ausente, JSONL incompleto o datos malformados detienen la importación; no se sustituyen silenciosamente por valores predeterminados.

Cada importación es atómica por transacción. Una reanudación compara los registros existentes y se detiene si difieren, sin sobrescribirlos. El SDK reintenta con token de idempotencia estable dentro de cada envío. No se invoca ningún canje en la migración.

La conciliación compara los elementos esperados, pero no certifica ausencia de elementos adicionales fuera de la exportación. Completar conteos totales y revisión de pendientes antes del corte.

## Corte

1. Completar QA, secretos y observabilidad.
2. Detener escrituras Java, drenar y resolver canjes inciertos.
3. Obtener respaldo/exportación final consistente.
4. Importar, conciliar campos, conteos y muestras.
5. Probar autenticación y operaciones controladas en AWS.
6. Cambiar destino en el frontal manteniendo dominio y rutas.
7. Observar latencia, errores y conciliaciones.

## Recuperación

PITR conserva 35 días. Una restauración crea otra tabla: cambiar referencia y probar antes de recibir tráfico. La reversión de código usa una versión Lambda anterior o artefactos conservados.

Volver a Java después de aceptar escrituras AWS requiere detener tráfico y reconciliar cambios hacia SQL mediante un procedimiento revisado. No basta revertir DNS. Esta entrega no aplica automáticamente una exportación inversa a SQL.
