# Contexto para continuar el desarrollo

Actualizado: 2026-10-22. Este documento conserva acuerdos y puntos de entrada de este chat para modificar o ampliar funcionalidades. Complementa el [contexto general](README.md); no sustituye las especificaciones ni los ADR.

## Requisitos confirmados por el usuario

- Node.js 24 en Lambdas y herramientas propias; AWS SDK v3 con clientes y comandos modulares; ESM nativo con import/export y soporte de top-level await. No resolver incompatibilidades incorporando SDK v2 o CommonJS al código propio.
- TypeScript compilado antes de ejecutar con esbuild/serverless-esbuild. No usar ts-node, tsx ni transformaciones TypeScript durante la ejecución. Target ES2025, resolución NodeNext y paquetes Lambda .mjs.
- Conservar Serverless Framework 3.40.0, serverless-esbuild 1.57.2 y esbuild 0.28.2, con infraestructura en serverless.yml y validación estricta del runtime nodejs24.x mediante el plugin local.
- Replicar los contratos y efectos del Java. No corregir anomalías observables, completar descuentos sin implementar, cambiar mensajes ni introducir deduplicación o reenvíos de canjes como parte incidental de otra funcionalidad.
- No descargar JDK ni ejecutar el proyecto, Maven o pruebas Java. La referencia es el código de `/Users/alain/Documents/PROGRAMACION/PROYECTOS/AWS/SOAINT_CUPONERA_ALSEA_MX/MDW AZURE JAVA/Cuponera`; su inventario está en [source-baseline.json](../../docs/source-baseline.json).
- El usuario autorizó adaptaciones propias ESM de herramientas cuando una actualización transitiva corregida cambie su interfaz. No autorizó excepciones de seguridad ni flexibilizar las versiones anteriores.
- Fundamentar decisiones duraderas con evidencia y alternativas en ADR en español. Seleccionar las skills según la tarea; su catálogo no determina la arquitectura.

## Estado comprobado al cierre de la implementación

La última ejecución registrada aprobó 118 pruebas, comprobación de tipos, instalación limpia y empaquetado/carga/ejecución local de seis ZIP para cada entorno dev/qa/prod. Se verificaron Node.js 24, ESM, top-level await, SDK v3 y SHA-256 de artefactos. Los 84 hashes de referencia Java no cambiaron.

La auditoría pasó de 23 paquetes afectados, incluidos 4 críticos, a 15: 0 críticos, 9 altos, 5 moderados y 1 bajo. La auditoría de dependencias de producción registró cero avisos conocidos. Estos números describen aquella ejecución: no son una auditoría nueva ni una garantía sobre avisos publicados posteriormente. Evidencia y alcance en [verificación](../../docs/verification.md).

No se ejecutaron despliegues, migraciones reales, cambios DNS ni llamadas a proveedores reales. Los ZIP ejecutaron SDK v3 contra simulación local, con salida externa bloqueada. Eso no comprueba IAM, KMS, el motor DynamoDB, API Gateway real ni paridad ejecutada contra Java.

## Dónde modificar y qué comprobar

| Área | Entradas de implementación | Regresiones relevantes |
| --- | --- | --- |
| Transporte HTTP | src/http/application.ts, negotiation.ts, problems.ts y documentation.ts | test/http.test.ts y test/negotiation.test.ts; estados, cabeceras, cuerpos y orden de efectos. |
| Negocio | src/domain/coupons.ts y discounts.ts | test/domain.test.ts; promociones, restricciones, marca 20/60, Starbucks/Chipotle y redondeos. |
| Contratos y mensajes | src/core/types.ts, validation.ts, json.ts, legacy-errors.ts y src/contracts/openapi.ts | Coerciones, nulos, precisión, mensajes y OpenAPI; no aplicar validación más restrictiva silenciosamente. |
| Proveedores y persistencia | src/infrastructure/providers.ts, http.ts y repository.ts | test/providers.test.ts y test/persistence.test.ts; timeouts sin reenvíos inciertos, atomicidad, pendientes y detalle S3. |
| Herramientas | package.json, package-lock.json y scripts/toolchain-compat.mjs | test/toolchain.test.ts; interfaces reales de terceros, hashes, extracción y empaquetado. |
| Infraestructura y operación | serverless.yml, plugins/, infra/resources.js, src/core/logging.ts y scripts/deploy.ts | test/infrastructure.test.ts, inspección de artefactos y ejecución local del ZIP; distinguir esas pruebas de validación AWS. |

Para una funcionalidad nueva, seguir el recorrido completo de la solicitud, no solo el handler. El transporte compartido sirve a todas las funciones; un cambio allí puede afectar autenticación, documentación y errores de otras operaciones.

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
npm run typecheck
npm test
npm run verify
npm run audit:dependencies
```

Elegir las comprobaciones según el cambio. verify ejecuta tipos, pruebas, empaquetado dev, inspección/carga de ZIP, simulación local y registro del manifiesto de integridad; no sustituye audit:dependencies. Este último falla mientras haya avisos y conserva informes en .cache/security/. Un error de red tampoco permite aprobar seguridad.

Usar npm run package o npm run serverless -- <comando> para cargar el preload ESM. No invocar un CLI global ni el binario directamente. El adaptador limita tres consumidores por ruta, hash y coincidencia única; si falla tras actualizar dependencias, revisar la interfaz y repetir regresiones antes de cambiar el hash. No desactivar el guard ni parchear node_modules manualmente.

CI separa verificación funcional y auditoría completa. El despliegue con --execute exige auditoría sin avisos e integridad del paquete. El script de despliegue sin --execute también consulta identidad AWS y configuración regional: no tratarlo como una comprobación exclusivamente local. Un manifiesto SHA-256 detecta cambios, pero no firma procedencia ni demuestra seguridad.

El auditor genérico de la skill produce acciones por CodeBuild ausente y por archivos de terceros/cachés que clasifica como propios. No se declara aprobado. El verificador específico comprueba fuentes propias y ZIP; consultar los límites en verification.md antes de interpretar resultados.

## Bloqueos abiertos y criterio de cierre

| Bloqueo | Situación y siguiente evidencia necesaria |
| --- | --- |
| Cadena de herramientas | Quedan tres causas raíz: braces, sprintf-js y una dependencia aws-sdk de terceros. Demostrar una sustitución corregida compatible y repetir instalación, pruebas de consumidores, empaquetado e inspección. No usar allowlist, renombrado de código vulnerable ni una fachada parcial de SDK para aprobar el audit. |
| Paridad HTTP | Persisten textos JVM, orden de validaciones múltiples, fallos secundarios de @ExceptionHandler, charset y cabeceras del frontal. Cerrar solo con resultado determinado desde fuentes o evidencia existente aprobada; no ejecutar Java ni normalizar diferencias contractuales para ocultarlas. |
| Aceptación AWS y corte | Faltan datos de cuenta/dominio/secretos, pruebas reales de integraciones, carga, IAM, alarmas, recuperación y reconciliación SQL. Esta actualización de contexto no autoriza despliegue ni migración. |

No convertir el saneamiento parcial en aprobación productiva. Consultar [dependencias](../../docs/dependency-remediation.md), [HTTP](../../docs/http-parity.md), [migración](../../docs/migration.md) y [ADR 0004](../decisions/0004-toolchain-adapters-and-http-parity.md) antes de retomar esos pendientes.
