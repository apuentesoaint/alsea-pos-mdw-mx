# Contexto del proyecto

Actualizado: 2026-10-23. Leer la [guía de continuidad](development-handoff.md) antes de modificar o construir funcionalidades. Esta actualización registra la consolidación del secreto y las verificaciones locales ejecutadas; no acredita despliegues ni AWS real.

## Hechos confirmados

- El usuario reportó un primer despliegue AWS rechazado con `Parameter values specified for a template which does not require them` y stack dev inexistente. La revisión del código de Serverless 3.40.0 confirmó parámetros propios enviados a la plantilla provisional del bucket. `plugins/infrastructure.mjs` ahora los filtra durante esa fase y restaura la lista antes de la plantilla completa; regresiones locales con Serverless real y AWS simulado. Ver [creación inicial](../../docs/serverless-infrastructure.md#creación-inicial-y-parámetros-del-stack). El reintento AWS queda pendiente.
- `prj-cuponera-back-mdw-sls` implementa localmente el middleware Cuponera con TypeScript 7.0.2, compilación previa a ESM para Node.js 24 y AWS SDK v3 modular. Serverless Framework 3.40.0 genera un stack por entorno dev/qa/prod en us-east-1.
- La arquitectura conserva API Gateway REST Regional, seis Lambdas, DynamoDB, S3, Secrets Manager externo, IAM y CloudWatch. La infraestructura declarativa está en `infra/**/*.yml`, referenciada desde `serverless.yml`; el generador `infra/resources.js` fue retirado. Se conserva el identificador local del usuario `TransactionsPOS` y su output `TransactionsPOSName`.
- El usuario confirmó un único secreto manual de DevOps para dev: `cuponera-api-security/dev/aws-mdw`. `serverless.yml` centraliza su nombre mediante securitySecretName/SECURITY_SECRET_ID; el stack no crea secretos ni KMS. `jwt_clientSecret` autentica y firma HS384 como UTF-8 (mínimo 48 bytes), con invalidación de los JWT anteriores aceptada. Cuponera y Starbucks usan los demás campos del JSON y comparten caché. La migración SQL usa archivo privado (--sql-config) o JSONL (--file). Ver [ADR 0007](../decisions/0007-single-devops-security-secret.md).
- `serverless.yml` centraliza variables Lambda y parámetros públicos por entorno. Solo generación conserva una URL stage activa de referencia en dev. Los endpoints comentados del Java no se activan por defecto; lo desconocido usa REPLACE_ME/.invalid. No se cargaron versiones reales de secretos ni se copiaron credenciales a las plantillas.
- El usuario autorizó la migración y las revisiones, pero indicó no descargar JDK ni ejecutar Java/Maven. La referencia solo se analiza estáticamente; sus 84 archivos mantuvieron los hashes del [inventario](../../docs/source-baseline.json).
- ESLint 10.13.0 analiza JavaScript propio. TypeScript sigue bajo tsc estricto: typescript-eslint 8.72.0 declaró soporte menor a 6.1.0 al revisarlo; no se fuerza ese parser sobre TypeScript 7.0.2. cfn-lint 1.58.0 se prepara en un venv local y valida la plantilla compilada. Los controles están en verify, CI y el despliegue protegido.
- Las revisiones corrigieron la omisión de controles en deploy, informes cfn-lint obsoletos, cobertura JavaScript incompleta, payloads dummy, fechas IAM y sustituciones redundantes. La validación admite HTTP únicamente para openapiDevUrl en loopback y rechaza puertos SQL inválidos/prefijos Basic duplicados antes de cargar secretos.
- Se conservan los contratos y efectos Java. Hay caracterización HTTP y un catálogo de 16 mensajes JVM, pero siguen pendientes las variantes señaladas en [paridad HTTP](../../docs/http-parity.md).
- La revisión corrigió parámetros vacíos rechazados por el CLI de Framework 3 usando --config nativo temporal con valores públicos literales; lectura privada por descriptor; fuentes SQL ambiguas y credenciales imposibles. Ver [revisión](../../docs/single-secret-review.md).
- Hay 151 skills principales registradas en `skills-lock.json`; el [catálogo](../skills/README.md) permite seleccionar las pertinentes. Su disponibilidad no implica que sus servicios formen parte de esta arquitectura.

## Última evidencia registrada

| Comprobación | Resultado registrado el 2026-10-23 |
| --- | --- |
| npm run verify | Aprobado: ESLint, tipos, 146 pruebas, empaquetado dev, cfn-lint, inspección/carga de seis ZIP, simulación local e integridad. |
| Matriz de infraestructura | Revisión: dev/qa/prod empaquetados, cfn-lint sin errores (7 advertencias por plantilla), seis ZIP y simulación funcional en los tres. QA con nombre/KMS ficticios sobrescritos; prod con vacíos explícitos mediante --config nativo. Sin AWS real. |
| Auditoría npm completa | Bloqueada: 2 paquetes afectados, ambos bajos; producción con cero avisos conocidos. No hay excepciones aprobadas. |
| Contexto y herramientas | Auditoría de 151 skills sin errores, pip check e integridad aprobados. |

Los resultados previos de 118/120/121/127/129/134/141 pruebas y 23/15/10 paquetes afectados son históricos. No sumar conteos ni tratarlos como el estado actual. La [revisión del secreto único](../../docs/single-secret-review.md) registra correcciones y evidencia actual; el [análisis de secretos](../../docs/secrets.md) conserva la comprobación inicial. La [revisión detallada](../../docs/serverless-quality-review.md) conserva las pasadas anteriores, casos, fuentes y límites; una actualización documental no renueva esa evidencia.

## Pendiente y bloqueos

- Cerrar los avisos de herramientas sin desactivar el gate ni simular dependencias corregidas. El informe renovado recoge aws-sdk transitivo y su metavulnerabilidad en Serverless; braces/sprintf-js pertenecen a informes históricos. Renovar los conteos al retomar el saneamiento: [dependencias](../../docs/dependency-remediation.md).
- Completar cuenta AWS, dominio/certificados, URLs reales y credenciales operativas Starbucks (los marcadores APISBX se rechazan). Confirmar clave KMS del secreto externo y existencia de QA/prod; DevOps conserva carga/rotación. Los dummies permiten empaquetar, no habilitan una integración operativa.
- Certificar variantes HTTP pendientes sin ejecutar Java ni modificar contratos implícitamente.
- Obtener exportación SQL, zona horaria/intercalación, criterios de desempate, reconciliación y responsables de corte/canjes inciertos.
- Validar integraciones, JWT, IAM/KMS, API Gateway, alarmas, recuperación y carga con AWS real. No se desplegó infraestructura, migraron datos ni ejecutó CI remoto en este chat. No se certificó compliance con cfn-guard ni producción.

## Entradas para continuar

- [Continuidad de desarrollo](development-handoff.md): requisitos, mapa de archivos, comandos y precauciones.
- [Requisitos de infraestructura y calidad](../specs/serverless-infrastructure-and-quality.md): alcance confirmado y criterios de conservación.
- [ADR](../decisions/README.md): decisiones aceptadas; 0005 para YAML, 0006 para controles y 0007 para el secreto único.
- [README](../../README.md), [infraestructura](../../docs/serverless-infrastructure.md), [calidad](../../docs/code-quality.md), [secretos](../../docs/secrets.md), [migración](../../docs/migration.md) y [operación](../../docs/operations.md).
- [Auditoría de skills](skills-audit.md): accesibilidad y límites del catálogo.

Mantener aquí los hechos vigentes y enlaces. Los resultados detallados y su historia pertenecen a sus informes; los requisitos a specs y las decisiones duraderas a decisions. Documentación y contexto en español; nombres de archivos y carpetas en inglés.
