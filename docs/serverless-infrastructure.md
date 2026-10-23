# Infraestructura Serverless y configuración de origen

Análisis y cambio: 2026-10-23. Referencia Java examinada estáticamente, sin ejecutar Java, Maven ni Docker.

## Construcción del stack

Serverless Framework 3.40.0 resuelve variables y referencias `${file(...)}` desde `serverless.yml`, compila seis handlers TypeScript a ZIP ESM para Node.js 24/arm64 mediante serverless-esbuild y produce un único stack CloudFormation por entorno. Dividir los archivos no crea stacks anidados ni cambia la propiedad de los recursos.

Antes del cambio, `serverless.yml` declaraba las funciones y `infra/resources.js` generaba los recursos mediante objetos y bucles. Ahora la infraestructura declarativa se distribuye así:

| Archivo | Responsabilidad |
| --- | --- |
| `serverless.yml` | Servicio, provider, variables Lambda, parámetros públicos por entorno, retención, referencia al secreto único externo de DevOps. |
| `infra/functions.yml` | Seis funciones, roles, rutas HTTP/ANY y activos Swagger. |
| `infra/build.yml` | Compilación ESM, target node24, alias YAML y concurrencia. |
| `infra/stack.yml` | Descripción, metadatos, condiciones, outputs y extensión de API Gateway. |
| `infra/resources/storage.yml` | Tabla TransactionsPOS, bucket de detalles y política HTTPS. |
| Secreto externo | DevOps administra el secreto y su cifrado; el stack solo declara su referencia y permisos. |
| `infra/resources/iam.yml` | Roles mínimos por función y política del operador de migración. |
| `infra/resources/gateway.yml` | Cuenta/rol de logging, grupo de ejecución y respuestas de error. |
| `infra/resources/observability.yml` | Alarmas de aplicación, DynamoDB y Lambda, latencia y dashboard. |

Los plugins ESM conservan únicamente lógica necesaria del framework: `node24.mjs` amplía su validación del runtime; `infrastructure.mjs` añade la dependencia del grupo de logs al Deployment de API Gateway y filtra los parámetros durante la creación provisional del stack. El adaptador de herramientas ESM sigue siendo necesario para las versiones fijadas.

### Creación inicial y parámetros del stack

Serverless 3.40.0 crea primero un stack provisional para el bucket de despliegue. Esa plantilla no declara `GatewayLogsRoleArn` ni `SecuritySecretKmsKeyArn`, pero el framework le pasa también `provider.stackParameters`. CloudFormation rechaza la solicitud con `Parameter values specified for a template which does not require them`; el stack puede no existir después del fallo.

El plugin filtra esos parámetros antes de `aws:deploy:deploy:createStack` para enviar únicamente los declarados en la plantilla provisional, y restaura la lista original después de esa fase. La plantilla completa sigue recibiendo los valores explícitos, incluidos los vacíos y el rol regional existente, tanto en la primera instalación como en actualizaciones. Se aplica también a `deploy --package`; no requiere cambiar las URI ni crear manualmente el stack o el bucket. La regresión `test/bootstrap-deployment.test.ts` usa los métodos reales de Serverless con solicitudes AWS simuladas para creación directa, change sets y stacks existentes. La aceptación con AWS real queda pendiente.

Comprobaciones de esta corrección: compilación, 13 pruebas dirigidas (bootstrap, flujo de despliegue e infraestructura), ESLint, tipos, empaquetado dev, cfn-lint (cero errores y siete advertencias existentes), inspección/carga de seis ZIP, simulación local del runtime y registro de integridad aprobados. No se ejecutó el despliegue AWS ni se renovó la auditoría npm o la suite completa; no se certificó compliance con cfn-guard.

El tráfico entra por API Gateway REST Regional y llama directamente al handler de cada operación. Las rutas ANY permiten que autenticación y errores de métodos alternativos se procesen en la aplicación. Las Lambdas consultan sus secretos con SDK v3 y caché; los roles restringen la lectura al ARN del secreto único. DynamoDB guarda transacciones con PK/SK y recuperación puntual; S3 conserva detalles mayores de 300 KiB. No se añade VPC ni cambia el contrato HTTP.

Se conservan identificadores lógicos, retención, cifrado, políticas y permisos del estado local recibido, incluido el cambio previo del usuario a `TransactionsPOS`. No se renombra nuevamente la tabla. Los identificadores de versiones Lambda y Deployment son generados y pueden variar entre paquetes.

## Configuración encontrada en Java

Se revisaron los archivos del árbol de origen, incluidos archivos ocultos, `application.yaml`, `application.properties`, `Dockerfile`, `azure-pipelines.yml` y las copias bajo `target/classes`. No hay `.env` ni `docker-compose.yml` en la referencia recibida. El Dockerfile copia el YAML sin definir las variables; el pipeline construye imágenes sin proporcionar esos valores. `application.properties` solo configura logging.

| Configuración AWS | Evidencia en el origen | Resultado |
| --- | --- | --- |
| CUPONERA_URI_TOKEN | `application.yaml:73-74`: variable externa y URL stage comentada. | Ejemplo comentado por HTTP, sin vigencia acreditada: se mantiene como referencia documental y se configura un dummy HTTPS. |
| CUPONERA_URI_VALIDATE_V1 | `application.yaml:75-76`: variable externa y URL stage comentada. | Ejemplo comentado, sin vigencia acreditada: dummy con barra final. |
| CUPONERA_URI_REDEEM_V1 | `application.yaml:78-79`: variable externa y URL stage comentada. | Ejemplo comentado, sin vigencia acreditada: dummy. |
| CUPONERA_URI_GENERATE | `application.yaml:82`: URL stage activa. | Valor público trasladado a dev. |
| APISBX_URI / VERSION / PATH_TOKEN / PATH_SERVICE_COUPONS | `application.yaml:102-109`: referencias externas sin valores. | Dominio `.invalid` y rutas/versiones `REPLACE_ME`. |
| OPENAPI_DEV_URL / OPENAPI_PROD_URL | `application.yaml:97-98`: valores activos. | Se conservan localhost:8080 y alsea-api.com en parámetros del principal. |
| GENERATE_MOCK / CAMPAIGN / PROMOTION_ONE / PROMOTION_TWO | YAML y constantes de `CuponServiceImpl.java`. | Se conservan false, FMR, OZ y S8 ya presentes. |
| JWT_TTL_SECONDS | `JwtTokenProvider.java`: vigencia de 24 horas. | Se conserva 86400. |

Las URLs comentadas no demuestran cuáles usa el entorno Java desplegado y no se activan como defaults. Qa y prod usan dominios dummy; no heredan los endpoints stage. La versión Starbucks y sus rutas también quedan explícitamente pendientes. Las URLs de documentación del proyecto, enlaces de proveedores de herramientas, ejemplos de pruebas y conexiones SQL comentadas no son endpoints de negocio y no se trasladan a Lambda.

`params.default` reúne los marcadores pendientes y valores públicos comunes; `params.dev` conserva solo la URL activa de generación y utiliza dummies para los endpoints comentados. Se puede completar el archivo principal o usar `--param` mediante el despliegue protegido. `provider.environment` contiene todas las variables consumidas por Lambda; no se crea un archivo externo de variables.

La [revisión del secreto único](single-secret-review.md) documenta la inspección posterior por archivo, correcciones de herramientas/configuración y evidencia de los tres entornos.

## Secretos y límites del traslado

Desde la decisión del 2026-10-23 se consume un solo secreto externo administrado por DevOps: `cuponera-api-security/dev/aws-mdw`. Se retiraron los cinco contenedores y la clave KMS del stack. Las variables anteriores se sustituyen por `SECURITY_SECRET_ID`; la caché y el cliente SDK v3 comparten esa referencia entre los consumidores de cada ejecución.

El [análisis de secretos](secrets.md) documenta el mapeo de los cinco campos, las ausencias de firma JWT/SQL, IAM, KMS externo y la transición de recursos retenidos. Las credenciales no se trasladan desde el Java ni desde la conversación. No se trasladan claves AWS de Maven ni Azure Application Insights. Las identidades AWS siguen usando roles temporales.

## Comprobación y límites

Se ejecuta la verificación del proyecto y empaquetado local de los tres entornos. La comparación de los recursos propios antes/después comprueba que la separación conserva la infraestructura; la inspección de artefactos detecta referencias inexistentes, políticas IAM con fecha convertida por YAML, retención y dependencias de logs. Resultados de esta ejecución: `npm run verify` aprobado (tipos, 120 pruebas, empaquetado dev, inspección/carga de seis ZIP, simulación local de proveedores y registro de integridad). Empaquetado, `verify-artifacts` y `verify-runtime` aprobados también para qa y prod. Los 30 recursos propios, condiciones y outputs son equivalentes a la plantilla del estado local previo; el stack generado contiene 89 recursos. La auditoría de contexto/skills registra 151 skills y cero errores; `git diff --check` no detectó problemas. Los 84 archivos del inventario Java conservan sus hashes.

Las fechas `Version: '2012-10-17'` de IAM llevan comillas: el cargador YAML de Serverless puede convertir una fecha sin comillas y generar un valor incorrecto aunque el empaquetado termine.

No se despliega infraestructura, no se cargan secretos ni se llama a proveedores. La auditoría de dependencias y los bloqueos previos de aceptación siguen separados de esta refactorización. Actualización posterior del 2026-10-23: se incorporó cfn-lint al flujo verify y CI; ver [calidad](code-quality.md). Este análisis conserva la evidencia de la refactorización inicial; los nuevos controles de esquema y el ajuste del parámetro GatewayLogsRoleArn se documentan allí. No se certificó compliance con cfn-guard ni validación AWS por cuenta.

## Fuentes de consulta

- [Variables desde archivos YAML](https://www.serverless.com/framework/docs/guides/variables/file): sintaxis `${file(...)}`; comprobada con el Framework local fijado en 3.40.0.
- [Recursos CloudFormation de Serverless](https://www.serverless.com/framework/docs/providers/aws/guide/resources): composición y extensiones de recursos.
- [ADR 0003](../.agents/decisions/0003-secrets-and-observability.md): secretos recuperados en ejecución.
