# Compatibilidad con el código Java

## Fuente y método

La referencia es Cuponera, versión Maven 1.0.5. [source-baseline.json](source-baseline.json) registra hashes de 84 archivos, referencias de entorno y números de línea sensibles, sin copiar valores. El usuario indicó no descargar JDK 21 ni ejecutar el Java: no se ejecutaron Maven, tests Java ni el servicio como referencia.

Se siguen controladores, DTO, servicios, repositorios y utilidades actuales. Las pruebas AWS son caracterización estática, no respuestas capturadas del Java.

## Matriz funcional

| Área | Comportamiento y fuente |
| --- | --- |
| Autenticación | AuthController/AuthService/JwtTokenProvider: respuesta sin sobre; credenciales incorrectas 401 vacío; expiresIn es vencimiento epoch en texto; HS384 con clave Base64 e iat igual a exp. |
| Seguridad | SecurityConfig/JwtAuthenticationFilter: bearer sin distinción de mayúsculas; token y healthcheck públicos solo en sus métodos; documentación según lista pública. Sin OIDC ni límites nuevos por marca. |
| Validación | CuponController/CuponServiceImpl: marca 20 pasa a 60; Starbucks solo para marca 10; UID generado si falta fcUID externo. No se reemplaza un UID externo informado. |
| Descuentos | ValidacionServiceImpl: tipos 1–6, restricciones, artículos/modificadores; tipo 7 conserva resultado nulo y mensaje «Cupón no definido». |
| Moneda | Decimal con redondeos explícitos: Colombia escala 0/HALF_UP, Chile escala 2/CEILING, otros escala 2/HALF_UP. |
| Efectos previos al error | Se guarda la validación antes de rechazar por artículos/familias descartados. |
| Canje | Consulta UID/sucursal y compara descuento numéricamente. Starbucks se consulta incondicionalmente para todas las marcas. Zona Chile: -4 en canje, -3 en validación. |
| Pagos | Cadena separada por comas conserva orden y duplicados; paymentMethodId se establece en 0. |
| Empleado nulo | Se conserva el error al desempaquetar Integer nulo para JDBC; no se inventa un empleado predeterminado. |
| Generación | Envía fcSocioID, campaña FMR, promoción OZ/S8 y país; valida otros campos que luego no envía. Solo devuelve coupon.code. |
| Mock generación | Tipos 1/2: MXSJH00981/MXSJH00982. Lambda mantiene GENERATE_MOCK=false. |
| Última transacción | El SQL filtra FDFECHAREDEEM IS NULL. Sin resultado: HTTP 200, uid/data nulos y mensaje actual. |
| Errores | GlobalExceptionHandler: validaciones y técnicos conocidos 400; persistencia 500 genérico. Errores MVC tienen Problem Details separado. |
| Telemetría | test-insights conserva texto/seguridad y emite TestEvent en CloudWatch sin consumir Azure. |

Sobre: uid, timestamp con cuatro cifras fraccionarias sin sufijo de zona, status, type, message, helpUrl, success, data. Healthcheck conserva texto literal y Content-Type JSON aunque el cuerpo no sea una cadena JSON entrecomillada.

## Rutas técnicas

Los controladores propios son autenticación, cupones y telemetría. El POM no incluye starter Actuator; los POM locales de Application Insights y Azure Starter consultados tampoco lo declaran directamente. El YAML management.endpoints no crea endpoints por sí solo. Por ello `/actuator/**` conserva protección y ausencia de recurso; no se inventan métricas JVM.

Swagger UI 5.2.0 se empaqueta localmente, sin CDN. OpenAPI describe rutas, modelos y nombres del origen. No se afirma igualdad byte a byte con la salida generada por springdoc: no se ejecutó Java.

## Diferencias y límites registrados

- El test Java calculatePromotionAmountDiscountSubtractsPromotionAmountByQuantity espera 120 para artículos 100/80 y monto 30. El método actual resta 30 una vez y calcula 150. Se conserva el método, no la expectativa desactualizada.
- Las escrituras DynamoDB de metadatos, pagos y referencias son atómicas, según el plan aprobado. No se imitan conexiones JDBC defectuosas ni estados SQL parcialmente confirmados por fallos de infraestructura.
- No hay atomicidad entre canje HTTP y DynamoDB: se registran resultados inciertos, sin prometer exactamente una vez ni reenviar canjes inciertos.
- El repositorio Java no aporta DDL, intercalación, índices, zona de sesión ni datos exportados. Confirmarlos antes del corte. Empates de fecha se desempatan por UID en AWS; el SQL no define desempate.
- Mensajes generados por JVM/Spring y negociación HTTP se reconstruyen estáticamente. La negociación Accept ya se implementa para los casos ensayados, preservando el momento de efectos, y 16 mensajes por nulos están centralizados. Los [límites HTTP](http-parity.md) incluyen charset no UTF-8, resolución secundaria de excepciones y mensajes dependientes del entorno. No se certifica identidad total para todas las entradas/cabeceras.
- Los límites HTTP de Lambda/API Gateway siguen vigentes; S3 evita el límite del detalle DynamoDB, pero no amplía la entrada HTTP.

Estas condiciones pendientes no se presentan como comprobaciones aprobadas.
