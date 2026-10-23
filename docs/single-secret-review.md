# Revisión detallada del secreto único

Fecha: 2026-10-23. Alcance: cambios de consolidación solicitados para `cuponera-api-security/dev/aws-mdw`, incluida la firma con jwt_clientSecret confirmada por el usuario y las correcciones de esta revisión. El árbol de trabajo ya tenía cambios de infraestructura/herramientas de sesiones anteriores; no se revierte ese trabajo ni se atribuye íntegramente a esta revisión.

## Dictamen

El código consume un solo identificador por entorno y reutiliza los cinco campos acordados. Mantiene Node.js 24, TypeScript estricto, ESM, compilación previa, Serverless 3.40.0 y SDK v3 modular. Se corrigieron defectos de configuración y herramientas descritos abajo. Las comprobaciones locales evalúan casos concretos; no demuestran funcionamiento para todos los estados posibles ni sustituyen pruebas en AWS.

La decisión de usar jwt_clientSecret como clave de firma se respeta, pero no permite afirmar separación de responsabilidades entre consumidor y emisor de JWT: quien conoce esa credencial conoce la clave HMAC. La auditoría de herramientas sigue bloqueada. La entrega no queda certificada para producción.

## Hallazgos y correcciones

| Prioridad | Hallazgo reproducible | Corrección y evidencia |
| --- | --- | --- |
| P1 | Serverless 3.40.0 rechaza `--param=securitySecretKmsKeyArn=`. El validador admitía el vacío, pero el despliegue lo transmitía así; fallaba el caso con clave AWS administrada. Lo mismo podía afectar starbucksVersion/publicBasePath vacíos. | `withServerlessParameters` conserva el CLI para valores no vacíos; si hay vacíos, crea una configuración JSON pública temporal en la raíz, mezcla los parámetros del entorno y usa --config nativo. Conserva rutas relativas e inclusiones YAML y elimina el archivo en finally. Pruebas con CLI real y subprocesos simulados; no se modifica node_modules. |
| P2 | La carga aceptaba espacios exteriores en jwt_clientId/jwt_clientSecret, pero /auth/token los rechaza en su contrato existente. Algunos valores de proveedores tampoco eran representables como cabeceras HTTP. | Rechazar antes de AWS espacios exteriores y valores incompatibles con Headers en Cuponera/Starbucks. No recortar ni transformar credenciales. Pruebas de espacios, CR/LF, NUL y caracteres fuera de ByteString; Unicode válido se conserva en autenticación. |
| P2 | --file junto con --sql-config ignoraba silenciosamente SQL. --file con --export ignoraba la exportación. | Rechazar fuentes ambiguas y exportación desde JSONL. Pruebas del CLI aseguran que esos errores ocurren sin consultas SQL/AWS. |
| P2 | El permiso del archivo se comprobaba por stat(ruta), seguido por otra apertura al leer; la ruta podía apuntar a otro archivo entre ambas operaciones. Tampoco se rechazaban explícitamente entradas no regulares. | Lector compartido abre una vez, comprueba tipo/permisos mediante el mismo descriptor, lee y cierra en finally. O_NONBLOCK evita esperar un escritor de FIFO. Rechazo de directorios/FIFO, permisos de grupo/otros y JSON inválido; errores sin contenido ni rutas. |
| P3 | La verificación del paquete descartaba recursos secretos propios, pero no comprobaba que IAM apuntara al mismo identificador recibido por Lambda. | Inspección de CloudFormation compilado: seis Lambdas, seis roles, mismo nombre/ARN, transporte seguro, condición KMS, clave concreta, ViaService, contexto de cifrado y ausencia de referencias antiguas. |

El uso de --config interpreta variables de Serverless. Por ello el archivo público de despliegue rechaza `${...}` y `{{resolve:...}}` en sus valores antes de usar AWS o generar una configuración temporal. Los parámetros operativos deben ser literales; no se agrega un canal para resolver secretos al empaquetar.

## Inspección por archivo y responsabilidad

| Archivos revisados | Comprobación y resultado |
| --- | --- |
| src/core/config.ts, .env.example | Solo SECURITY_SECRET_ID; sin fallback a los cuatro ARN anteriores. TTL y parámetros públicos conservados. Ejemplo corregido para describir nombre en lugar de ARN. |
| src/core/security-fields.ts | Cinco campos exactos conocidos; rechazo de ausentes, vacíos, marcadores, espacios exteriores y cabeceras imposibles. Firma con bytes UTF-8 íntegros y mínimo de 48 bytes; sin Base64/hex implícitos. |
| src/domain/auth.ts | Comparación con timingSafeEqual sobre hashes de longitud fija; clientId/clientSecret HTTP se mapean a jwt_clientId/jwt_clientSecret. HS384, iat=exp y expiresIn en texto conservados. Validación heredada HS256/HS384 sin añadir nuevas políticas de claims. |
| src/infrastructure/secrets.ts | Un cliente reutilizable, SDK v3, agrupación de solicitudes en curso, caché de 300 segundos y cancelación por presupuesto Lambda. Errores no se cachean como éxitos; al vencer no se entrega una versión caducada si falla la actualización. Se prueban SecretString/SecretBinary y estructuras inválidas. |
| src/infrastructure/providers.ts | Basic se añade una vez; Starbucks usa sbx_client/sbx_secret en cabeceras y SHA-256 con timestamp. Vigencias de tokens y reintento del GET tras 401 conservados. No se añaden reenvíos de canjes. |
| serverless.yml, infra/stack.yml | Nombre independiente por entorno, clave KMS opcional y transmisión explícita de SecuritySecretKmsKeyArn al crear/actualizar. Outputs antiguos retirados; output del nombre único. Sin resolver valores secretos en variables o plantillas. |
| infra/resources/iam.yml, retirada de infra/resources/secrets.yml | Seis roles con GetSecretValue al nombre concreto, cuenta y región. Sufijo de seis comodines de un carácter; KMS solo si se configura, limitado a la clave, servicio y contexto del secreto. MigrationPolicy conserva DynamoDB/S3, sin secretos/KMS. No se sustituyen recursos de datos. |
| scripts/secret-payload.ts, scripts/seed-secrets.ts | Valida JSON completo antes del cliente AWS; conserva campos adicionales y ClientRequestToken de idempotencia. Rechazo de AWSCURRENT salvo --replace. DescribeSecret/PutSecretValue simulados; ausencia de valores sensibles en salida incluso ante errores. |
| scripts/private-json.ts, scripts/sql-configuration.ts, scripts/migrate.ts | Lectura privada compartida, validación SQL antes de conectar, puertos numéricos o cadenas 1–65535 y TLS con certificado validado. --file sigue sin consultar SQL; --sql-config conserva extracción/exportación. Sin MIGRATION_SECRET_ARN. SQL exclusivamente del operador. |
| scripts/deployment-config.ts, scripts/serverless-parameters.ts, scripts/deploy.ts | Nombres sin comodines, ARN KMS validado, valores públicos literales, vacíos explícitos compatibles con Framework 3 y limpieza de temporales. Conserva comprobación de cuenta/rol regional, separación de credenciales de empaquetado y bloqueo por auditoría antes de publicar. |
| scripts/serve.ts, scripts/verify-runtime.mjs | Simulación local usa el mismo esquema. No genera una clave de firma ajena al requisito; LOCAL_CLIENT_SECRET debe cumplir el mínimo. El ejercicio de ZIP conserva JWT, validate, S3, latest, redeem, generate, Accept y Swagger. |
| scripts/verify-artifacts.mjs | Inspección del paquete compilado, consistencia Lambda/IAM/KMS, retención de datos, runtime/ESM, SDK v3 y ausencia de secretos/clave creados por el stack. |
| test/fixtures.ts, test/http.test.ts, test/negotiation.test.ts, test/providers.test.ts, test/persistence.test.ts | Fixtures adaptadas al esquema único; contratos de HTTP, negocio, proveedores y persistencia se siguen ejecutando en la suite completa. Los dos últimos conservan su implementación de pruebas anterior y complementan las regresiones nuevas. |
| test/security.test.ts, test/tooling.test.ts, test/secret-loading.test.ts | Mapeo integrado, lectura SDK única, firmas UTF-8, clave anterior inválida, rotación, límites de longitud, TTL, fallos/recuperación y ausencia de valores sensibles en HTTP/logs; carga y fallos de configuración. |
| test/private-json.test.ts, test/migration-cli.test.ts, test/serverless-parameters.test.ts, test/deployment-flow.test.ts, test/infrastructure.test.ts | Pruebas de archivos reales, FIFO, SQL/SDK simulados, CLI Serverless real para vacíos, parámetros y limpieza en éxito/fallo, ausencia de publicación tras errores e invariantes YAML. |
| .gitignore, README.md, docs/secrets.md, docs/migration.md, docs/verification.md y docs/serverless-infrastructure.md | Temporales de configuración ignorados; instrucciones de entorno, rotación, uso SQL y límites actualizados. Ningún valor real añadido. |
| .agents/context/*, .agents/specs/*, .agents/decisions/0003-*.md y 0007-*.md e índices | Se mantiene la separación entre decisiones confirmadas, evidencia local y pendientes AWS. ADR 0003 sustituido parcialmente, ADR 0007 vigente; informes históricos no se convierten en aceptación actual. |

## Matriz funcional comprobada

- Autenticación válida/inválida, JWT vencido/inválido, firma con la credencial UTF-8 actual, rechazo de la clave independiente anterior y cambio de credencial/firma al rotar. Se comprueban 47/48 bytes y UTF-8 multibyte.
- Autenticación y ambos proveedores reutilizan una sola lectura SDK en el mismo entorno de ejecución. No se presupone caché compartida entre Lambdas distintas.
- Caché vigente, expiración exacta, actualización concurrente, fallo durante actualización sin fallback caducado, recuperación y plazo Lambda agotado.
- Respuestas de secreto vacías, JSON malformado, null, array, escalar y SecretBinary válido. Errores SDK/JSON no aparecen con sus valores en respuestas HTTP ni registros.
- Carga inicial y reemplazo autorizado; rechazo de sustitución no autorizada, dummies, campos antiguos/incompletos, claves cortas, permisos abiertos y errores SDK. Se verifica el JSON enviado completo y el token de idempotencia.
- JSONL sin consultas SQL; archivo SQL privado con puerto en cadena, TLS, cierre de conexión y exportación privada; opciones ambiguas/configuración inválida fallan sin consultas externas.
- Nombres por entorno, override de nombre/KMS y caso sin clave KMS propia. Resolución real de vacíos en Framework 3; paquete y despliegue simulado reciben la misma configuración pública y la limpian después de errores.
- Regresiones de HTTP y negocio: autenticación antes de negociación, efectos anteriores al 406, promociones/países/marcas, canjes, atomicidad, detalle S3 y documentación. Son pruebas locales de contratos definidos, no paridad ejecutada contra Java.

## Evidencia ejecutada

`npm run verify` final aprobado: ESLint, TypeScript estricto, **146 pruebas**, empaquetado dev, cfn-lint con **cero errores y siete advertencias existentes**, inspección/carga de los seis ZIP, simulación funcional con SDK v3 contra loopback e integridad SHA-256. Además se ejecutaron git diff --check y el auditor de enlaces/151 skills sin errores.

| Entorno/caso | Comprobación ejecutada | Resultado |
| --- | --- | --- |
| dev | Flujo verify completo y regeneración final del paquete, cfn-lint, seis ZIP, simulación e integridad | Aprobado localmente. |
| qa | Nombre único sobrescrito y ARN KMS ficticio; empaquetado, cfn-lint, seis ZIP y simulación | Aprobado localmente. |
| prod | Vacíos explícitos en KMS, versión Starbucks y base pública mediante --config; empaquetado, cfn-lint, seis ZIP y simulación | Aprobado localmente. |
| CLI Framework 3 | print real con nombre sobrescrito y vacíos explícitos; rutas/inclusiones conservadas | Aprobado; la prueba no llama AWS. |
| Publicación protegida | SDK/subprocesos simulados; parámetros no vacíos/vacíos, éxito, fallo de lint/auditoría/integridad y limpieza | Aprobado; ninguna publicación real. |
| Auditoría npm | Árbol completo y producción | Bloqueada por dos paquetes bajos de herramientas; producción cero. |

El primer empaquetado prod con la copia temporal encontró ENOSPC en el equipo. Se interrumpió, se limpiaron exclusivamente artefactos propios generados y se repitió correctamente el empaquetado y los controles. La limpieza en finally cubre éxito y excepciones; una terminación forzada del proceso puede dejar la copia pública ignorada y exige limpieza local. No se tocaron datos o recursos AWS.

 La auditoría renovada registra dos paquetes afectados de severidad baja (aws-sdk transitivo y metavulnerabilidad de Serverless), con cero avisos de producción. `npm run audit:dependencies` falla de forma deliberada; el gate de cero avisos se conserva. No se modificaron dependencias ni el lockfile en esta revisión y no se atribuye a este cambio la diferencia respecto a los diez paquetes del informe previo.

## Límites y pendientes

1. Reutilizar jwt_clientSecret como clave HMAC permite al consumidor firmar tokens: la credencial no es un secreto exclusivo del emisor. La política heredada acepta sub no vacío y no exige exp/iss/aud; no se endurece silenciosamente porque cambiaría la política de autenticación conservada. Separar emisor/consumidor y definir claims obligatorios requiere otra decisión de autenticación. La longitud en bytes no demuestra entropía.
2. Los seis roles pueden leer todos los campos del JSON; IAM no separa el acceso por campo. El patrón de ARN también autoriza un recurso recreado con el mismo nombre. Son consecuencias del esquema y permisos por nombre confirmados.
3. Rotación JWT y credenciales propaga por caché hasta 300 segundos, con versiones potencialmente distintas entre Lambdas. Coordinar la ventana del corte; no se promete revocación instantánea.
4. DevOps debe confirmar credenciales Starbucks reales, tipo/ARN/política KMS y existencia de QA/prod. Los marcadores APISBX comunicados no son credenciales operativas.
5. Archivos privados comprobados por descriptor y permisos POSIX. Windows requiere controlar ACL por el procedimiento del operador; no se certifica con los bits POSIX. No se prueba resistencia frente a otro proceso del mismo propietario que modifique el contenido del archivo abierto.
6. Secretos/KMS retirados de stacks previamente desplegados quedan sujetos a sus políticas Retain anteriores. No se borraron recursos AWS ni se certificó su inventario real.
7. No se ejecutaron despliegues, llamadas a proveedores, SQL real, migración de datos, CI remoto, JDK/Maven ni Java. Sin validación efectiva de IAM/KMS/API Gateway/CloudWatch en la cuenta. cfn-guard/reglas no disponibles: sin certificación de compliance. La auditoría de herramientas sigue bloqueada.

## Referencias primarias contrastadas

- [Prácticas de Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html): almacenamiento, caché, rotación y permisos.
- [Políticas IAM de Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/auth-and-access_iam-policies.html): permisos concretos, KMS y sufijo de ARN.
- [Cifrado de secretos](https://docs.aws.amazon.com/secretsmanager/latest/userguide/security-encryption.html): clave administrada, contexto y ViaService.
- [Node.js 24, FileHandle](https://nodejs.org/docs/latest-v24.x/api/fs.html): apertura, stat y lectura sobre un descriptor.
- [Política de seguridad de jose](https://github.com/panva/jose/security/policy): la aplicación define claims y autorizaciones.
- Serverless 3.40.0 instalado: `node_modules/@serverless/dashboard-plugin/lib/resolve-params.js` exige valor no vacío; `node_modules/serverless/lib/cli/resolve-configuration-path.js` soporta JSON y exige configuración en la raíz. El comportamiento se contrastó con el CLI real.
- [GHSA-j965-2qgj-vjmq](https://github.com/advisories/GHSA-j965-2qgj-vjmq): aviso que persiste en herramientas; no se incorpora SDK v2 al código propio ni a Lambda.
