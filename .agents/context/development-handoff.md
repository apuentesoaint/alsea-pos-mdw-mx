# Contexto para continuar el desarrollo

Actualizado: 2026-10-23. Este documento conserva acuerdos y puntos de entrada de este chat para modificar o ampliar funcionalidades. Complementa el [contexto general](README.md); no sustituye las especificaciones ni los ADR.

## Requisitos confirmados por el usuario

- Node.js 24 en Lambdas y herramientas propias; AWS SDK v3 con clientes y comandos modulares; ESM nativo con import/export y soporte de top-level await. No resolver incompatibilidades incorporando SDK v2 o CommonJS al código propio.
- TypeScript compilado antes de ejecutar con esbuild/serverless-esbuild. No usar ts-node, tsx ni transformaciones TypeScript durante la ejecución. Target ES2025, resolución NodeNext y paquetes Lambda .mjs.
- Conservar Serverless Framework 3.40.0, serverless-esbuild 1.57.2 y esbuild 0.28.2, con infraestructura en serverless.yml y validación estricta del runtime nodejs24.x mediante el plugin local.
- Replicar los contratos y efectos del Java. No corregir anomalías observables, completar descuentos sin implementar, cambiar mensajes ni introducir deduplicación o reenvíos de canjes como parte incidental de otra funcionalidad.
- No descargar JDK ni ejecutar el proyecto, Maven o pruebas Java. La referencia es el código de `/Users/alain/Documents/PROGRAMACION/PROYECTOS/AWS/SOAINT_CUPONERA_ALSEA_MX/MDW AZURE JAVA/Cuponera`; su inventario está en [source-baseline.json](../../docs/source-baseline.json).
- El usuario autorizó adaptaciones propias ESM de herramientas cuando una actualización transitiva corregida cambie su interfaz. No autorizó excepciones de seguridad ni flexibilizar las versiones anteriores.
- Infraestructura mayormente en YAML modular desde `serverless.yml`, con variables/parámetros públicos centralizados. Si el Java no contiene los valores reales, usar dummies explícitos; no activar ejemplos comentados ni incorporar secretos al repositorio. Ver [requisitos de infraestructura/calidad](../specs/serverless-infrastructure-and-quality.md).
- ESLint y cfn-lint forman parte de verify, CI y el despliegue protegido; no forzar typescript-eslint sobre TypeScript 7.0.2 para ampliar cobertura. Las versiones de herramientas instaladas son el estado actual y deben reevaluarse con sus compatibilidades al actualizarlas.
- Fundamentar decisiones duraderas con evidencia y alternativas en ADR en español. Seleccionar las skills según la tarea; su catálogo no determina la arquitectura.

## Estado local registrado y límites

La revisión del secreto único del 2026-10-23 aprobó npm run verify con 146 pruebas, ESLint, tipos, empaquetado dev, cfn-lint, inspección/carga de seis ZIP, simulación funcional e integridad SHA-256. Se empaquetaron y validaron dev/qa/prod con seis ZIP y simulación en los tres; QA con nombre y clave KMS ficticios sobrescritos, prod con vacíos explícitos mediante --config nativo. cfn-lint registra cero errores y siete advertencias por plantilla. Los hashes Java anteriores son evidencia histórica: no se ejecutó ni modificó el Java en esta revisión.

La auditoría completa más reciente sigue bloqueada por 2 paquetes afectados (ambos bajos); producción registra cero. Los resultados de 118/120/121/127/129/134/141 pruebas y 23/15/10 paquetes afectados pertenecen a ejecuciones anteriores. No se renueva ninguno de estos resultados al editar este contexto.

La [revisión detallada del secreto único](../../docs/single-secret-review.md) registra correcciones y evidencia actual; el [análisis](../../docs/secrets.md) conserva la entrega inicial. La [revisión detallada](../../docs/serverless-quality-review.md) enumera cada grupo de cambios, correcciones, casos ejecutados y limitaciones. No se desplegaron recursos, migraron datos, cargaron secretos reales ni llamó a proveedores. Las pruebas usan SDK v3 contra simulación local o sustituyen SDK/subprocesos; no validan IAM/KMS, API Gateway, DynamoDB real ni paridad contra Java. No se ejecutó CI remoto ni se certificó compliance/producción.

## Dónde modificar y qué comprobar

| Área | Entradas de implementación | Regresiones relevantes |
| --- | --- | --- |
| Transporte HTTP | src/http/application.ts, negotiation.ts, problems.ts y documentation.ts | test/http.test.ts y test/negotiation.test.ts; estados, cabeceras, cuerpos y orden de efectos. |
| Negocio | src/domain/coupons.ts y discounts.ts | test/domain.test.ts; promociones, restricciones, marca 20/60, Starbucks/Chipotle y redondeos. |
| Contratos y mensajes | src/core/types.ts, validation.ts, json.ts, legacy-errors.ts y src/contracts/openapi.ts | Coerciones, nulos, precisión, mensajes y OpenAPI; no aplicar validación más restrictiva silenciosamente. |
| Proveedores y persistencia | src/infrastructure/providers.ts, http.ts y repository.ts | test/providers.test.ts y test/persistence.test.ts; timeouts sin reenvíos inciertos, atomicidad, pendientes y detalle S3. |
| Herramientas | scripts/private-json.ts, scripts/serverless-parameters.ts, package.json, package-lock.json y scripts/toolchain-compat.mjs | test/toolchain.test.ts; interfaces reales de terceros, hashes, extracción y empaquetado. |
| Configuración/despliegue | serverless.yml, scripts/deployment-config.ts y scripts/deploy.ts | test/tooling.test.ts y test/deployment-flow.test.ts; dummies, HTTPS, excepción OpenAPI en loopback, cuenta esperada, rol regional y bloqueo de publicación. |
| Carga de secretos | src/core/security-fields.ts, scripts/secret-payload.ts, scripts/seed-secrets.ts y docs/secrets.md | test/tooling.test.ts y test/secret-loading.test.ts; cinco campos, dummies, prefijo Basic, firma UTF-8, AWSCURRENT/--replace y ausencia de valores en salida. |
| Análisis estático | eslint.config.mjs, scripts/lint-infrastructure.mjs, requirements-dev.txt y .github/workflows/verify.yml | test/quality-tools.test.ts; cobertura JavaScript, versión del ejecutable, informe obsoleto, salida inválida, fallo/señal y advertencias. |
| Infraestructura y operación | serverless.yml, infra/**/*.yml, plugins/, src/core/logging.ts y scripts/deploy.ts | test/infrastructure.test.ts, inspección de artefactos y ejecución local del ZIP; distinguir esas pruebas de validación AWS. |

Para una funcionalidad nueva, seguir el recorrido completo de la solicitud, no solo el handler. El transporte compartido sirve a todas las funciones; un cambio allí puede afectar autenticación, documentación y errores de otras operaciones.

## Mapa de infraestructura y configuración

| Entrada | Responsabilidad |
| --- | --- |
| serverless.yml | Servicio/provider, variables Lambda, params.default/dev, retención, inclusiones y referencia al secreto único. |
| infra/functions.yml / infra/build.yml | Funciones y eventos; compilación ESM/esbuild. |
| infra/stack.yml | Descripción/metadatos, parámetros, condiciones, outputs y extensión del gateway. |
| infra/resources/storage.yml | DynamoDB/S3 y políticas de conservación; DevOps administra el secreto/KMS externo. |
| infra/resources/iam.yml / gateway.yml / observability.yml | Roles por operación, logs/cuenta/respuestas del gateway, alarmas y dashboard. |
| plugins/node24.mjs / infrastructure.mjs | Validación del runtime y orden del Deployment respecto al grupo de logs. |

`infra/resources.js` ya no existe. No reintroducir un generador para cambios declarativos rutinarios. Conservar `TransactionsPOS` y su output `TransactionsPOSName`; no restaurar el nombre previo por encontrarlo en informes históricos.

Los ejemplos comentados de token/validate/redeem del Java permanecen como referencia documental; sus defaults son dummies también en dev. Solo generación tiene URL stage activa en dev. APISBX permanece pendiente; qa/prod no heredan stage. El secreto único externo y su clave KMS opcional se configuran con securitySecretName/securitySecretKmsKeyArn; se retiraron custom.secretPayloadTemplates y los contenedores anteriores. El [mapeo del origen](../../docs/serverless-infrastructure.md) conserva la procedencia sin valores sensibles.

`GatewayLogsRoleArn` es un parámetro CloudFormation String validado, con vacío para creación o ARN existente para reutilización. `provider.stackParameters` lo transmite expresamente en actualizaciones; no confiar solo en cambiar un Default. Las fechas `Version: '2012-10-17'` de IAM deben ir entre comillas para evitar la conversión YAML a fecha.

## Particularidades que deben preservarse

- La autenticación precede a la negociación en rutas privadas. Un Accept inválido no debe sustituir un 401 vacío.
- Healthcheck declara produces JSON. Los DTO sin produces negocian al escribir: validate puede haber guardado y redeem puede haber confirmado antes de responder 406. No mover globalmente la negociación al inicio ni revertir o reenviar esas operaciones por el 406.
- Conservar la particularidad q=0 reconstruida de Spring 6.1.3 y la sustitución de la cabecera simple por multiValueHeaders, sin duplicar valores.
- Los 16 mensajes JVM centralizados tienen códigos internos; no están certificados contra una JVM. No sustituirlos por textos del motor JavaScript ni declarar paridad total por pasar las pruebas locales.
- Los charset no UTF-8 siguen pendientes. El transporte conserva UTF-8 y registra HttpParityGaps/http.charset-not-certified; esta diferencia es explícita, no una decisión aprobada de cambiar el contrato.

Más reglas de negocio y anomalías: [compatibilidad](../../docs/compatibility.md). Matriz HTTP y fuentes Spring: [paridad HTTP](../../docs/http-parity.md).

## Comandos y precauciones para continuar

```sh
npm ci --ignore-scripts
npm run lint
npm run typecheck
npm test
# Una vez por entorno de trabajo; requiere Python e instala cfn-lint en .cache:
npm run setup:infra-lint
npm run verify
npm run audit:dependencies
```

La preparación de cfn-lint requiere Python >=3.10 y <3.15, crea `.cache/cfn-lint` y debe repetirse si se elimina ese directorio. CI usa Python 3.14. No es una instalación global ni un requisito para ejecutar únicamente tipos/pruebas. Ver [calidad](../../docs/code-quality.md): ESLint cubre JavaScript propio; TypeScript 7.0.2 sigue bajo tsc.

Elegir las comprobaciones según el cambio. verify ejecuta ESLint, tipos, pruebas, empaquetado dev, cfn-lint, inspección/carga de ZIP, simulación local y registro del manifiesto de integridad; no sustituye audit:dependencies. Este último falla mientras haya avisos y conserva informes en .cache/security/. Un error de red tampoco permite aprobar seguridad.

`npm run lint:infra` valida la plantilla ya empaquetada (puede recibir otro directorio con `-- /ruta/paquete`). El informe vigente está en `.cache/quality/cfn-lint.json`; no es fuente versionada de hechos ni debe contener secretos. Los errores bloquean; quedan siete advertencias visibles W3005/W8003 de generación Serverless, sin suprimir reglas. Los tests limitan a tres archivos concurrentes y sus fixtures no llaman AWS.

Usar npm run package o npm run serverless -- <comando> para cargar el preload ESM. No invocar un CLI global ni el binario directamente. El adaptador limita tres consumidores por ruta, hash y coincidencia única; si falla tras actualizar dependencias, revisar la interfaz y repetir regresiones antes de cambiar el hash. No desactivar el guard ni parchear node_modules manualmente.

El despliegue protegido exige su archivo de configuración pública con cuenta/URLs válidas; editar defaults del principal no completa ese archivo automáticamente. Rechaza REPLACE_ME y dominios .invalid, exige HTTPS salvo openapiDevUrl por HTTP en localhost, 127.0.0.1 o ::1. Serverless 3 no admite --param=key=. El despliegue protegido usa --config JSON público temporal en la raíz si existen vacíos explícitos, conservando los parámetros del entorno y limpiando en finally. Los valores públicos no pueden incluir resolutores ${...} ni {{resolve:...}}. No omitir vacíos como solución porque perdería overrides. El lector JSON privado valida tipo/permisos sobre el mismo descriptor que lee; no combinar fuentes SQL. El CLI Serverless directo puede empaquetar dummies: no sustituye el flujo protegido.

La carga segura valida antes de crear el cliente AWS los cinco campos del secreto único: cuponera_mx_credential, jwt_clientId, jwt_clientSecret, sbx_client y sbx_secret. Rechaza prefijo Basic y dummies REPLACE_ME/APISBX. El usuario confirmó reutilizar jwt_clientSecret como clave HS384 UTF-8, mínimo 48 bytes, aceptando invalidar los JWT anteriores. No decodificar Base64/hex ni volver a un secreto de firma separado. Conservar permisos privados y AWSCURRENT/--replace. El CLI usa --id y el JSON completo; no usa --kind ni fusiona versiones. SQL usa --sql-config privado o --file; nunca MIGRATION_SECRET_ARN. Ver [ADR 0007](../decisions/0007-single-devops-security-secret.md).

CI separa verificación funcional y auditoría completa. El despliegue con --execute exige auditoría sin avisos e integridad del paquete. El script de despliegue sin --execute también consulta identidad AWS y configuración regional: no tratarlo como una comprobación exclusivamente local. Un manifiesto SHA-256 detecta cambios, pero no firma procedencia ni demuestra seguridad.

El auditor genérico de la skill produce acciones por CodeBuild ausente y por archivos de terceros/cachés que clasifica como propios. No se declara aprobado. El verificador específico comprueba fuentes propias y ZIP; consultar los límites en verification.md antes de interpretar resultados.

## Bloqueos abiertos y criterio de cierre

| Bloqueo | Situación y siguiente evidencia necesaria |
| --- | --- |
| Cadena de herramientas | El informe renovado registra dos paquetes afectados bajos: aws-sdk transitivo y la metavulnerabilidad de Serverless. Braces/sprintf-js quedan en los informes históricos. Repetir la auditoría al retomar el trabajo. Demostrar una sustitución corregida compatible y repetir instalación, pruebas de consumidores, empaquetado e inspección. No usar allowlist, renombrado de código vulnerable ni una fachada parcial de SDK para aprobar el audit. |
| Paridad HTTP | Persisten textos JVM, orden de validaciones múltiples, fallos secundarios de @ExceptionHandler, charset y cabeceras del frontal. Cerrar solo con resultado determinado desde fuentes o evidencia existente aprobada; no ejecutar Java ni normalizar diferencias contractuales para ocultarlas. |
| Aceptación AWS y corte | Faltan datos de cuenta/dominio/secretos, pruebas reales de integraciones, carga, IAM, alarmas, recuperación y reconciliación SQL. Esta actualización de contexto no autoriza despliegue ni migración. |

No convertir el saneamiento parcial en aprobación productiva. Consultar [dependencias](../../docs/dependency-remediation.md), [HTTP](../../docs/http-parity.md), [migración](../../docs/migration.md) y [ADR 0004](../decisions/0004-toolchain-adapters-and-http-parity.md) antes de retomar esos pendientes.
