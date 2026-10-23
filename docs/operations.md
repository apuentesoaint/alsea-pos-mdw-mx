# Operación y observabilidad

## Registros

Los handlers emiten JSON por consola hacia CloudWatch. Cada solicitud incluye `transactionId`, `requestId`, ruta, inicio, final y duración. Las llamadas externas registran proveedor, operación, estado y duración, sin cuerpo, autorización ni tokens. Los errores registran categoría, nombre de excepción y ubicaciones saneadas del stack, sin mensajes externos sensibles.

`X-Transaction-ID` conserva la correlación del origen donde corresponde. El identificador se limita a 128 caracteres y se eliminan caracteres de control. No usar correos, datos personales ni credenciales como identificadores de correlación.

Ejemplo de consulta Logs Insights sobre los grupos Lambda del entorno:

```sql
fields @timestamp, event, transactionId, requestId, route, provider, status, errorType
| filter transactionId = 'IDENTIFICADOR_DE_CORRELACION'
| sort @timestamp asc
| limit 200
```

Para diagnosticar errores técnicos convertidos a HTTP 400, buscar `operation.failed` y revisar `TechnicalErrors`; `Lambda Errors` por sí solo no los detecta. La retención es 7 días en dev, 14 en qa y 90 en prod. API Gateway registra acceso y ejecución sin trazas de cuerpos (`fullExecutionData: false`). Su rol de logs es regional y compartido; usar el script protegido de despliegue para reutilizar el existente.

## Métricas y alarmas

Las métricas EMF usan namespace `Cuponera` y dimensión `Stage`. Incluyen solicitudes, duración, errores técnicos, de validación, negocio, persistencia y proveedores, además de canjes inciertos. La plantilla crea dashboard de errores y latencia p95/p99; alarmas de errores técnicos, externos, persistencia, canjes inciertos, p95 y errores/throttling Lambda. El throttling DynamoDB suma ThrottledRequests por tabla y operación, respetando sus dimensiones publicadas.

Las alarmas quedan visibles en CloudWatch. No se configura un destinatario SNS ficticio: el propietario debe asociar el canal operativo real y probar su recepción en qa antes de producción.

## Canjes inciertos

El diario de intentos diferencia inicio, éxito externo, confirmación local e incertidumbre. Ante timeout o fallo después de contactar al proveedor, no reenviar automáticamente el canje. Detener el reintento del consumidor, buscar la correlación, consultar el resultado en el proveedor y reconciliar la transacción con intervención operativa. Una respuesta externa exitosa y una escritura local fallida también requieren conciliación. Los identificadores detallados del intento se conservan en la tabla, con acceso IAM restringido.

Los timeouts HTTP se acotan inicialmente a 5 segundos y al presupuesto restante de la solicitud. Lambda tiene 28 segundos. La renovación de autenticación externa no autoriza reintentos de canje o generación con resultado incierto.

`AWS_TIMEOUT_MS=5000` acota el envío SDK completo, incluidos sus reintentos, y conserva 500 ms del presupuesto Lambda para responder. Los clientes reutilizados limitan también conexión y solicitud. Un deadline agotado cancela llamadas nuevas; si el resultado de una escritura no es conocido, se conserva el detalle S3 para no romper un commit que podría haberse realizado.

## Carga y capacidad

Hipótesis aprobadas, todavía sin validación AWS: 10 solicitudes/s promedio, 50 sostenidas y ráfaga 200 durante 60 segundos; distribución 60 % validación, 20 % canje, 10 % generación y 10 % consulta. Pedidos habituales de 50 artículos más escenarios grandes/anidados. Memoria 512 MiB, p95 objetivo ≤ 3 s y p99 ≤ 5 s.

Ejecutar solamente sobre un entorno de prueba con datos y proveedores autorizados:

```sh
npm run load -- --url https://DOMINIO_QA/coupons/healthcheck --rps 50 --seconds 600
npm run load -- --url https://DOMINIO_QA/coupons/healthcheck --rps 200 --seconds 60
```

Para una operación autenticada usar `LOAD_BEARER_TOKEN` fuera del historial del shell, `--method POST --file /ruta/privada/solicitud.json`. El generador cuenta respuestas HTTP fallidas, solicitudes omitidas y percentiles; sale con código no cero al superar sus umbrales. Una prueba de healthcheck no valida capacidad de negocio. Ejecutar las cuatro operaciones con la mezcla indicada y medir cada endpoint, proveedores, concurrencia, cold starts, tamaño de detalle y costo real.

## Recuperación

DynamoDB usa capacidad bajo demanda, PITR de 35 días y no usa TTL, Streams ni réplica multirregión. S3 conserva versiones y bloquea acceso público. Ambos se retienen al eliminar la pila; producción protege además la tabla contra eliminación. Probar una restauración PITR en tabla nueva y actualizar la configuración antes de aceptar tráfico. No destruir la tabla anterior como parte de la prueba.

La reversión de código utiliza versiones Lambda; no revierte datos. Volver a Java después de recibir escrituras AWS exige detener tráfico y reconciliar hacia SQL, según [migration.md](migration.md). Revisar también versiones de secretos: su caché puede mantener una versión hasta 300 segundos.
