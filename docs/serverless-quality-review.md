# Revisión detallada de infraestructura y controles de calidad

Fecha: 2026-10-23. Alcance: todos los cambios locales de modularización Serverless, configuración procedente de Java, ESLint, cfn-lint, CI y documentación, incluidos archivos nuevos. Se preservaron los cambios recibidos del usuario, en particular TransactionsPOS. No se ejecutó Java ni se desplegaron recursos.

## Resultado y cumplimiento

La infraestructura declarativa está en YAML, con inclusiones desde serverless.yml; variables públicas, parámetros por entorno y estructuras dummy se mantienen en el principal. El generador JavaScript se retiró conservando los recursos del estado local recibido. Los secretos reales permanecen fuera de código y plantillas; se usan ARN y una carga separada. Los valores no disponibles están señalados, no inventados.

Los controles de calidad funcionan en los casos locales comprobados y se aplican en verify, CI y el despliegue protegido. No se detectaron regresiones en las rutas, contratos o efectos cubiertos por las pruebas. Esto no acredita todos los casos posibles ni sustituye las integraciones reales, la auditoría de dependencias o la aceptación productiva.

Se aplicaron las skills locales aws-cloudformation, aws-secrets-manager y aws-sdk-js-v3-usage para composición/retención, tratamiento de secretos y cambios de herramientas que usan SDK v3. Se consultaron los patrones de validación y errores de nodejs-backend-patterns sin trasladar Express/Fastify a los handlers Lambda. La skill javascript-testing-patterns mencionada por ese catálogo no está instalada; las comprobaciones se implementaron con node:test y las herramientas ya disponibles, sin atribuirle instrucciones.

## Hallazgos corregidos

| Prioridad | Hallazgo | Corrección y evidencia |
| --- | --- | --- |
| P1 | El flujo de despliegue protegido omitía ESLint y cfn-lint, aunque verify/CI ya los ejecutaban. | scripts/deploy.ts ejecuta ambos antes de inspeccionar artefactos y publicar. deployment-flow.test.ts invoca el entrypoint compilado, con SDK y subprocesos simulados; comprueba bloqueo ante fallos de lint, esquema, auditoría e integridad. |
| P1 | Un endpoint comentado del Java se activaba por defecto en dev usando HTTP para obtener tokens. Los otros endpoints comentados tampoco acreditaban valores vigentes. | Token, validate y redeem usan dummies HTTPS también en dev. Solo generación conserva su URL activa. El despliegue exige URLs HTTPS reales. |
| P1 | Rutas/versiones REPLACE_ME y payloads dummy de secretos podían superar la validación de estructura y llegar a operaciones AWS. | deployment-config.ts rechaza los marcadores y dominios .invalid incluso con punto final. secret-payload.ts valida antes de crear el cliente AWS. Se probaron carga inicial, rechazo de AWSCURRENT y sustitución con --replace, sin llamadas reales ni filtración de payloads. |
| P2 | Un fallo previo a la validación podía conservar el informe anterior de cfn-lint, dando evidencia obsoleta al publicar artefactos CI. | El informe se elimina al inicio; los fallos de preparación no dejan un resultado anterior. Se prueban ejecutable/plantilla ausentes, versión incompatible, salida vacía, JSON inválido, estructura inválida, señal y código de fallo. |
| P2 | La ejecución de cfn-lint no tenía tiempos máximos ni verificaba explícitamente el formato de su resultado. | Versión limitada a 10 segundos; validación a 120; estructura y severidades verificadas; errores globales con Path nulo admitidos y tratados como errores. No se aprueban señales ni códigos de fallo aunque el informe esté vacío. |
| P2 | ESLint solo aplicaba reglas recomendadas a algunos directorios; un nuevo archivo JavaScript propio fuera de ellos podía recibir únicamente análisis de sintaxis. | Patrón global de JavaScript/ESM propio, con exclusiones de terceros/artefactos. Pruebas no-undef en scripts, src y raíz. TypeScript permanece explícitamente fuera de este alcance. |
| P2 | commentBefore se serializó como campo real dentro de las plantillas de secretos. | Sustituido por comentarios YAML. El test exige exactamente los cinco tipos de payload. |
| P3 | Doce Fn::Sub de alarmas no contenían variables CloudFormation después de resolver Serverless. | Se usan las mismas cadenas resueltas directamente; métricas, nombres, periodos y umbrales conservados. Advertencias reducidas de 19 a 7 sin ignorar reglas. |

La revisión anterior ya había corregido la conversión YAML de Version IAM: las fechas están entre comillas y verify-artifacts exige '2012-10-17'. GatewayLogsRoleArn es un parámetro CloudFormation validado, transmitido explícitamente también en actualizaciones. Ambas correcciones se volvieron a comprobar.

## Evaluación por archivo o grupo

| Archivos | Objetivo y comprobación |
| --- | --- |
| serverless.yml | Orquestación única, parámetros por entorno, ARN y dummies. Se probaron defaults, --param, entorno dev/qa/prod y rol regional existente. Los payloads dummy de secretos no aparecen en la plantilla compilada. Las rutas públicas dummy sí aparecen deliberadamente hasta configurarlas. |
| infra/functions.yml | Mismos seis handlers, roles, eventos HTTP/ANY y activos Swagger que antes de extraerlos; comparación estructural exacta con la línea base local. |
| infra/build.yml | Misma configuración esbuild; comparación estructural exacta, Node.js 24, ESM, .mjs, SDK v3 y artefactos individuales comprobados. |
| infra/stack.yml y resources/gateway.yml | Se conservan outputs, dependencia de logs y condiciones; el ARN pasa por parámetro validado y stackParameters. La cuenta de API Gateway sigue siendo regional y compartida: su cambio efectivo requiere validación AWS. |
| resources/storage.yml | PK/SK, on-demand, PITR, protección prod, retención, bucket privado/versionado/cifrado y política HTTPS conservados. No se reemplaza TransactionsPOS ni se cambia TTL/Streams. |
| resources/secrets.yml | Cinco contenedores vacíos, KMS dedicado, rotación KMS y retención conservados. No hay SecretString con dummies ni datos reales. |
| resources/iam.yml | Mismos roles por operación, acciones y referencias del estado previo. El secreto SQL sigue fuera de los roles Lambda. |
| resources/observability.yml | Mismos umbrales, dimensiones, dashboard y métricas; solo se retiran sustituciones redundantes. Las siete advertencias restantes son visibles. |
| Retirada de infra/resources.js | Los identificadores de los 30 recursos se conservan. Se compararon semánticamente 29 recursos (normalizando Fn::Sub sin variables AWS); ApiGatewayAccount conserva el ajuste explícito documentado del parámetro. |
| eslint.config.mjs | Flat config ESM, globals Node, reglas recomendadas y orientadas a errores, sin reformateo masivo. Dependencias exclusivamente dev, sin parser TypeScript incompatible. |
| scripts/lint-infrastructure.mjs | Ejecuta el binario local exacto, sin shell ni descargas implícitas; valida la plantilla compuesta, falla cerrado y conserva informe estructurado vigente. Pruebas del protocolo con ejecutable simulado y validación adicional con cfn-lint real. |
| package.json / package-lock.json | Versiones exactas de ESLint y lock actualizado; ninguna versión de paquetes preexistentes cambió. npm ci --ignore-scripts aprobado. Los tests usan tres archivos concurrentes para acotar subprocesos. |
| requirements-dev.txt | cfn-lint 1.58.0 en venv local, sin instalación global. pip check aprobado. Las dependencias Python transitivas no tienen lock completo; la versión directa sí está fijada. |
| .github/workflows/verify.yml | Prepara Node 24/Python 3.14, instala herramientas, ejecuta verify y conserva el informe. La auditoría completa sigue en job independiente bloqueante. Se revisó el YAML; no se ejecutó GitHub Actions remotamente. |
| scripts/deploy.ts | Conserva comprobación de cuenta/rol, modo sin --execute, auditoría e integridad. Añade los controles omitidos. Las pruebas comprueban también que los controles locales no reciben credenciales AWS y que solo la publicación usa el entorno del operador. |
| scripts/deployment-config.ts | Mantiene lista de parámetros públicos permitidos y URLs HTTPS; añade rechazo explícito de marcadores y variantes de dominio .invalid. |
| scripts/seed-secrets.ts / secret-payload.ts | Mantienen permisos del archivo, forma de los campos, mínimo de firma, DescribeSecret/PutSecretValue y protección de rotación; rechazan dummies antes del SDK. Sin cambios en las lecturas de secretos de Lambda. |
| scripts/verify-artifacts.mjs | Conserva la adaptación previa TransactionsPOS; comprueba además las fechas IAM literales. Se vuelve a verificar carga de cada ZIP. |
| Tests nuevos y adaptados | Prueban decisiones y efectos observables: bloqueo de publicación, carga/rotación, ausencia de exposición, rechazo de configuraciones inválidas y resultados/fallos de herramientas. Los mocks no se presentan como ejecución AWS. |
| README, docs y .agents | Se documentan alcance, instalación, dummies, compatibilidad, resultados y límites; ADR 0005/0006 e índices actualizados. Se distinguen las verificaciones históricas de esta ejecución. |

## Evidencia de esta revisión

- npm ci --ignore-scripts: aprobado; sin cambios a versiones de dependencias preexistentes.
- npm run verify: aprobado, incluidas 127 pruebas, ESLint, tipos, empaquetado dev, cfn-lint, carga/inspección de seis ZIP, simulación funcional e integridad.
- Matriz de empaquetado/cfn-lint real: dev, qa, prod, reutilización de rol y sobrescritura de parámetros. Cero errores y siete advertencias en cada variante.
- verify-artifacts y verify-runtime para qa y prod: aprobados, seis ZIP por entorno; JWT, validate, detalle grande S3, latest, redeem, generate, negociación Accept y Swagger contra simulación local con SDK v3.
- Verificación de controles negativos: variables inexistentes, tamaño Lambda inválido, dummies, errores del ejecutable y fallos del flujo de publicación; se detienen como corresponde.
- pip check: sin requisitos incompatibles; auditor de contexto/skills: 151 skills, cero errores; git diff --check: aprobado.
- Los 84 archivos de referencia Java mantienen sus hashes; src/ no tiene modificaciones en este conjunto de cambios.
- npm run audit:dependencies: falla de forma esperada con 10 paquetes afectados (9 altos, 1 bajo); producción cero. No se oculta el bloqueo.

Informes/logs locales de trabajo: .cache/review-final-verify.log, .cache/review-final-audit.log y .cache/quality/review-*.json. Son evidencia local ignorada por Git, no una ejecución remota de CI.

## Límites y pendientes

1. El despliegue productivo sigue bloqueado por los avisos de dependencias y los pendientes previos de paridad HTTP/aceptación. No se aprobaron excepciones.
2. TypeScript 7.0.2 carece de cobertura ESLint mientras typescript-eslint no declare soporte; tsc estricto continúa vigente.
3. Quedan siete advertencias cfn-lint: seis W3005 del DependsOn redundante de roles generado por Serverless y una W8003 de condición resuelta por entorno. No se altera el framework para eliminarlas.
4. Las URLs y secretos faltantes deben completarse por sus propietarios. Se rechazan dummies en el despliegue protegido, pero invocar directamente Serverless puede empaquetarlos y desplegarlos; ese CLI no sustituye el flujo protegido documentado.
5. Falta validar con AWS real IAM/KMS, rol compartido de logs, ejecución HTTP, recuperación, alarmas, proveedores y rotación efectiva. No hubo despliegue, carga real de secretos, pruebas Java ni ejecución remota de CI.
6. cfn-lint comprueba esquemas, no certifica seguridad/compliance; no se ejecutó cfn-guard. La instalación documentada de herramientas Python es POSIX (macOS/Linux), no una certificación Windows.
7. Se revisaron todas las rutas de cambio y los casos enumerados; no se afirma cobertura exhaustiva de todas las combinaciones de negocio o estados operativos.

## Fuentes primarias

- [ESLint: flat config y patrones](https://eslint.org/docs/latest/use/configure/configuration-files).
- [Compatibilidad de typescript-eslint](https://typescript-eslint.io/users/dependency-versions/), contrastada con los peerDependencies publicados.
- [cfn-lint](https://github.com/aws-cloudformation/cfn-lint), contrastado con el ejecutable y formateador JSON de 1.58.0 instalado.
- [Referencia de Serverless](https://www.serverless.com/framework/docs/providers/aws/guide/serverless.yml), contrastada con el código local de Framework 3.40.0 que transmite stackParameters a CloudFormation.


## Segunda revisión del estado final — 2026-10-23

Se volvió a examinar el diff completo (incluidos los archivos nuevos), la composición Serverless, las dependencias fijadas, los controles de CI, las estructuras de secretos y los tests de los comandos. Se mantuvieron las skills aws-cloudformation, aws-secrets-manager y aws-sdk-js-v3-usage; no se asumió que la instalación de herramientas equivalga a aceptación productiva.

Se encontraron tres defectos adicionales y se corrigieron:

| Hallazgo | Corrección | Casos comprobados |
| --- | --- | --- |
| El despliegue rechazaba OPENAPI_DEV_URL=http://localhost:8080, valor público confirmado y documentado del origen. | HTTP se admite solo para openapiDevUrl en localhost, 127.0.0.1 o ::1. Las integraciones siguen requiriendo HTTPS y ninguna URL admite usuario/contraseña. | Los tres loopbacks, dominios externos, falso subdominio localhost, credenciales en URL y HTTP en el endpoint de tokens. El entrypoint de despliegue se prueba ahora con el valor local confirmado. |
| La carga de secretos aceptaba un campo Cuponera basic con el prefijo Basic ya incluido. El proveedor añade ese prefijo y generaría una cabecera incorrecta. | Se rechaza el prefijo, incluidas variantes de mayúsculas/minúsculas y espacios iniciales, antes de crear el cliente AWS. No se transforma la credencial real. | Credencial sin prefijo aceptada; prefijos duplicados rechazados; el comando de carga no invoca el SDK para el payload incorrecto. |
| El payload SQL aceptaba puertos inválidos, que posteriormente se convertían mediante Number y rompían la conexión de migración. | Si existe port, se exige un entero entre 1 y 65535. Se conserva compatibilidad con números, cadenas numéricas y puerto omitido (1433 en el consumidor). | Extremos válidos, 1433 numérico/cadena, omitido, cero, negativo, mayor de 65535, fracción, vacío, texto, booleano, null y objeto. El comando acepta 1433 en cadena y rechaza el puerto inválido antes del SDK. |

Evidencia nueva: npm run verify aprueba 129 pruebas, ESLint, tipos, paquete dev, cfn-lint, carga de seis ZIP, simulación funcional e integridad. La recompilación y ejecución focalizada de siete pruebas de configuración, despliegue y carga de secretos también aprobaron con los nuevos fixtures. Los clientes y subprocesos de esas pruebas están simulados; no se crearon versiones reales de secretos ni se llamó a AWS.

Se volvieron a validar las plantillas de qa/prod de la matriz previa y la plantilla dev recién generada: cero errores y siete advertencias en cada una. No se volvieron a desplegar ni se reinterpretaron las simulaciones qa/prod anteriores como ejecuciones reales. La infraestructura y src/ no cambian en esta segunda revisión; las correcciones adicionales afectan únicamente herramientas y tests.

La auditoría se repitió y sigue fallando con 10 paquetes afectados (9 altos y 1 bajo), producción cero. pip check, integridad y auditoría de contexto/skills aprobaron. Las versiones de las herramientas y la limitación de typescript-eslint permanecen sin cambios.

Los límites de aceptación enumerados arriba siguen vigentes: falta evidencia real AWS/proveedores, quedan avisos de dependencias y no se afirma cobertura de toda combinación posible. Logs nuevos: .cache/review-second-verify.log, .cache/review-second-focused.log y .cache/review-second-audit.log.
