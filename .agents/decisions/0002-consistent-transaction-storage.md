# 0002 — Transacciones y referencias pendientes en DynamoDB

Fecha: 2026-10-22. Estado: aceptada en el plan solicitado por el usuario.

## Contexto y decisión

DynamoDB es un requisito confirmado. Los accesos Java son UID/sucursal y última validación pendiente por país/marca/sucursal/folio. Se usa una tabla por entorno con metadatos, detalle, pagos como lista y referencias pendientes en la tabla base. Guardar y canjear utiliza escrituras transaccionales y control de versión. Las lecturas de transacción y última pendiente son consistentes.

## Alternativas y motivos

Un GSI para pendientes tendría consistencia eventual, permitiendo mostrar un canje recién confirmado como pendiente. Scan aumentaría costo y latencia. Convertir pagos en un conjunto perdería orden y duplicados. SQL administrado conservaría el motor, pero incumpliría el almacenamiento acordado. Los cálculos usan decimal.js y serialización numérica precisa para aproximar BigDecimal sin aritmética binaria monetaria.

## Consecuencias

Las referencias se eliminan al canjear y se ordenan por fecha/UID; el origen SQL no determina empates. Detalles mayores de 300 KiB van a S3 privado versionado. Ante resultado transaccional incierto no se borra un objeto que podría estar referenciado. No existe transacción distribuida con el proveedor: un diario y métricas permiten conciliar sin reenviar canjes automáticamente. No se reproducen estados JDBC parcialmente confirmados por errores de infraestructura; esta diferencia queda explícita en compatibilidad.

La revisión posterior conserva los campos NULL del SQL y aísla un folio NULL de la cadena literal null. Las claves temporales normalizan a nueve cifras fraccionarias para ordenar datos importados de precisión diferente. La extracción SQL convierte dinero y fechas a texto antes del driver, evitando pérdida irreversible de precisión. No se silencian detalles ausentes en DynamoDB/S3.
