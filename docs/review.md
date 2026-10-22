# Revisión detallada de implementación

Fecha: 2026-10-22. Alcance: todos los archivos de aplicación, herramientas, infraestructura, configuración, dependencias y documentación añadidos o modificados para esta migración. Referencia Java analizada exclusivamente de forma estática. Los 84 hashes de la referencia siguen coincidiendo; no se modificó ni ejecutó Java.

## Dictamen

La revisión encontró defectos funcionales y operativos que las primeras pruebas no detectaban. Se corrigieron y se añadieron regresiones. Los controles locales aprueban los escenarios documentados, pero **no se aprueba todavía el corte productivo ni se certifica ausencia de diferencias para toda entrada posible**. Permanecen riesgos de herramientas de desarrollo y verificaciones externas pendientes.

## Hallazgos corregidos

| ID / prioridad | Hallazgo e impacto | Corrección y evidencia |
| --- | --- | --- |
| R01 / P1 | Forma de pago devolvía el folio como discountId, en lugar de fnFormaPagoMarca. | discounts.ts reproduce wayToPay; regresión del identificador y matriz de promociones. |
| R02 / P1 | Un amount como 1e-7 se redondeaba a cero al reconstruir el detalle del pedido. | json.ts normaliza BigDecimal conservando escala/exponentes; coupons.ts usa números JSON sin conversión a IEEE-754 ni expansión arbitraria del lexema. Pruebas de exponentes y detalle persistido. |
| R03 / P1 | SQL DECIMAL podía llegar convertido a Number y datetime2 perdía fracciones antes de importar. | CAST/CONVERT en SQL obtiene texto; migración conserva decimales y hasta nueve cifras fraccionarias. El índice de pendientes normaliza precisión para ordenar correctamente instantes equivalentes. |
| R04 / P1 | ticketId inválido se convertía con Number y podía enviarse al proveedor antes de fallar localmente. | Conversión Integer estricta en el mismo punto del flujo Java; tests rechazan fracciones, hexadecimal, vacío y overflow sin enviar canje. |
| R05 / P1 | Llamadas SDK podían consumir el presupuesto completo de Lambda sin margen de respuesta. | AbortSignal común cubre todos los intentos, acotado por AWS_TIMEOUT_MS y deadline de solicitud; conexión acotada. Prueba de presupuesto agotado y SDK real sobre transporte local. |
| R06 / P1 | Alarma ThrottledRequests tenía solo TableName y no coincidía con las métricas publicadas. | Suma por TableName y Operation. Se añadieron alarmas Lambda Errors/Throttles y latencia p95. Aserciones sobre configuración y plantillas empaquetadas. |
| R07 / P2 | Bines y medios de pago compartían parser, aunque el Java trata de forma distinta las comas vacías. | Parsers separados y regresiones de listas, errores y orden. |
| R08 / P2 | Deserialización incompleta de combos, campos opcionales, booleanos y listas con elementos null. | Validación anterior al proveedor, coerciones de DTO y null explícito; casos de tipos inválidos y primitivos Java. |
| R09 / P2 | Evaluación anticipada de AllItemsDiscart cambiaba el orden de efectos ante null. | Evaluación diferida después de guardar; pruebas de null dentro de items y de lista ausente, con efectos distintos como en Java. |
| R10 / P2 | Valores nulos de porcentaje podían interpretarse como cero. | Separación de valores realmente opcionales y operaciones que deben fallar; prueba de ausencia de persistencia. |
| R11 / P2 | Históricos NULL podían convertirse a 0, cadenas null o detalle vacío; un PAYLOAD ausente se ocultaba. | Modelo nullable, validación de JSONL, referencias sin colisión con folio literal null y error de persistencia ante detalle corrupto. Claves UID/sucursal ausentes detienen la importación. |
| R12 / P2 | Respuestas escalares de generación, errores de mapeo, mensaje técnico vacío y 401 del token Starbucks diferían del Java. | Coerción JsonNode.asText, mensaje del catch Java, conservación de vacío, distinción entre token y GET; no se reenvía el POST de token por un 401. Se conserva el tratamiento distinto de 5xx en validate y redeem. |
| R13 / P2 | Prefijos similares a Swagger quedaban públicos y faltaban cabeceras predeterminadas de Spring Security. | Límites de segmento y cabeceras comunes en respuestas y errores; regresiones de autenticación y cabeceras. |
| R14 / P2 | JSON de configuración malformado podía aparecer parcialmente en un mensaje de error del despliegue. | Validación separada, lista permitida de parámetros y mensajes propios seguros, sin copiar excepciones de parseo ni objetos SDK. |
| R15 / P2 | El inspector podía aprobar un directorio sin ZIP o reutilizar archivos extraídos antiguos; la política HTTPS se eliminaba al retener el bucket. | Exige seis ZIP, metafiles, referencias/condiciones válidas, extracción limpia y Retain de la política del bucket. Build y preparación de assets eliminan salidas obsoletas antes de generarlas. |
| R16 / P2 | Dependencia SQL de la herramienta tenía avisos de seguridad. | Actualización bloqueada a mssql 12.7.11. No se cambiaron Framework 3.40.0, serverless-esbuild 1.57.2 ni esbuild 0.28.2. |
| R17 / P2 | Los Integer de query usaban parseInt estricto, pero Spring elimina whitespace y admite hexadecimal. | Parser de RequestParam separado de la conversión de ticket/typeOrder; pruebas de espacios, hexadecimal y overflow basadas en NumberUtils 6.1.3. |
| R18 / P1 | Swagger perdía el stage al redirigir desde la URL execute-api de API Gateway. | Prefijo derivado de requestContext para esa URL; PUBLIC_BASE_PATH sigue permitiendo mapping de dominios personalizados. Se prueban redirect y swagger-config, además de YAML y PNG desde el ZIP. |

## Cobertura de la revisión

- **core, contratos y HTTP:** DTO, precisión, escalas, fechas, media types de entrada, JWT, seguridad, rutas, estados, sobres, OpenAPI, errores y logs. Pruebas de JSON incorrecto, campos ausentes, tipos, null, espacios, integer overflow y cabeceras.
- **domain:** los siete tipos de promoción, restricciones, redondeos, modificadores, marca 20/60 y efectos de persistencia. La matriz recorre 84 combinaciones de siete promociones, tres países y cuatro marcas. No sustituye la cobertura exhaustiva de todas las combinaciones de restricciones.
- **infrastructure:** clientes SDK modulares, caché y renovación, contratos de proveedores, timeouts, no reenvío incierto, escrituras atómicas, conflictos, consistencia fuerte, S3 versionado y diario de canje.
- **serverless.yml, infra y plugins:** runtime real, validación estricta, paquetes individuales, IAM por función, KMS, secretos sin valores, retención, logging, métricas y alarmas; inspección de CloudFormation generado.
- **scripts y CI:** compilación previa, importador/conciliador, secretos, despliegue protegido, servidor local, herramienta de carga, auditoría de fuentes/ZIP y bloqueo de dependencias. El workflow verifica también la auditoría de dependencias de producción.
- **documentación y contexto:** requisitos, ADR, inventario de fuente, operación, migración y límites de aceptación; enlaces locales comprobados.

## Verificación adicional del artefacto ejecutable

`verify-runtime.mjs` carga los seis handlers extraídos de los ZIP e invoca el SDK v3 real contra un servidor local. Prueba JWT, validación, escritura/lectura de detalle S3 mayor de 300 KiB, consulta pendiente, canje, pagos, generación y Swagger desde el directorio empaquetado. Bloquea solicitudes HTTP/HTTPS/fetch hacia hosts externos y emplea exclusivamente credenciales sintéticas.

Esta prueba verifica carga, firma/serialización SDK y composición del paquete. El servidor local no implementa el motor DynamoDB completo, IAM, KMS, consistencia distribuida ni API Gateway; las pruebas unitarias complementan condiciones y conflictos, pero ambas requieren validación posterior en AWS.

## Riesgos y pendientes

| Prioridad | Estado y acción necesaria |
| --- | --- |
| P1 | Auditoría completa inicial: 23 paquetes afectados, 4 críticos. El saneamiento posterior corrigió las causas críticas con versiones bloqueadas y adaptadores ESM comprobados; quedan 15 paquetes (0 críticos, 9 altos, 5 moderados y 1 bajo), correspondientes a tres causas raíz. Producción reporta cero avisos. CI y despliegue bloquean aceptación por cualquier aviso conocido, sin allowlist. Ver [saneamiento y límites](dependency-remediation.md). |
| P1 | Falta validar dev/qa real: CloudFormation/IAM/KMS, condiciones transaccionales, concurrencia, proveedores, JWT cruzados, restauración, alarmas, carga y costo. No se desplegó ni migró información. |
| P2 | No se certifica toda la negociación HTTP de Spring, especialmente Accept, representaciones alternativas, cabeceras del contenedor/frontal y textos de excepciones generados por JVM. La negociación Accept, cabeceras multivalor y efectos previos al 406 tienen pruebas estáticas nuevas; persisten límites de charset no UTF-8, excepciones secundarias y textos JVM. Ver [matriz HTTP](http-parity.md). |
| P2 | OpenAPI reconstruido estáticamente, empates SQL por UID, orden histórico de pagos sin columna de orden y zona/intercalación SQL requieren confirmación. Detalles en compatibility.md y migration.md. |

Para los errores técnicos se conserva deliberadamente el comportamiento heredado de respuesta; los logs no incluyen cuerpos ni mensajes externos. Una respuesta de error heredada puede contener texto del proveedor. Revisar cualquier cambio de ese contrato con los consumidores antes de endurecerlo.

## Referencias técnicas contrastadas

- [Node.js 24 en Lambda](https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html): runtime y condiciones de ejecución.
- [Handlers Node.js](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html): ESM y handlers asíncronos.
- [DynamoDB y dimensiones CloudWatch](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/metrics-dimensions.html): dimensiones de throttling y estadísticas.
- [NumberUtils de Spring 6.1.3](https://github.com/spring-projects/spring-framework/blob/v6.1.3/spring-core/src/main/java/org/springframework/util/NumberUtils.java): conversión numérica de parámetros de la referencia Spring Boot 3.2.2.

Los números de auditoría describen la ejecución de esta revisión, no un resultado permanente frente a avisos futuros.
