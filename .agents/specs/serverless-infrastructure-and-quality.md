# Infraestructura modular y controles de calidad

Fecha: 2026-10-23. Estado: requisitos solicitados y aplicación autorizada en este chat; implementación local verificada, aceptación AWS pendiente. Complementa la [migración](aws-migration.md), sin sustituir sus contratos ni autorizar despliegues.

## Actualización de secretos del 2026-10-23

El [ADR 0007](../decisions/0007-single-devops-security-secret.md) sustituye el modelo de cinco contenedores/plantillas dummy por un único secreto externo administrado por DevOps. No crear secretos ni clave KMS propios; validar el esquema único, conservar --replace y permisos privados. El SQL usa archivo privado del operador. Las reglas de retención siguen aplicando a DynamoDB/S3; los recursos de secretos retirados mantienen sus políticas históricas si ya se desplegaron. El usuario confirmó firmar con jwt_clientSecret como UTF-8 (mínimo 48 bytes), aceptando invalidar tokens anteriores. Los criterios históricos siguientes se leen con esta actualización.

## Requisitos confirmados

- Mantener la mayor parte de la infraestructura declarativa en archivos `.yml`, referenciados desde `serverless.yml`. El principal orquesta el servicio y centraliza las variables y parámetros de entorno.
- Revisar estáticamente el Java de referencia para identificar configuración y URLs. El usuario indicó usar valores dummy explícitos si no existen valores reales en archivos de configuración, .env o Docker Compose. No convertir comentarios en configuración activa verificada ni inventar URLs qa/prod.
- Conservar secretos fuera de código y plantillas, mediante identificador y recuperación en ejecución del secreto único externo. No resolver valores al empaquetar ni inyectarlos en variables Lambda.
- Aplicar ESLint de forma gradual, con reglas orientadas a errores e integración en verify/CI; cubrir TypeScript cuando haya una combinación compatible comprobada. No degradar TypeScript ni forzar peers incompatibles para declarar cobertura.
- Complementar el código con validación de la plantilla CloudFormation compuesta mediante cfn-lint. El despliegue protegido también ejecuta los controles. No sustituir auditoría de dependencias por lint o pruebas funcionales.
- Revisar los cambios usando las skills pertinentes y conservar evidencia de los casos ejecutados y sus límites, sin prometer cobertura exhaustiva ni aceptación productiva por pruebas locales.

## Criterios que deben conservar futuras funcionalidades

1. Funciones/eventos declarados en YAML; recursos agrupados por responsabilidad; plugins ESM solo para la lógica necesaria del framework. Un stack por entorno, sin introducir stacks anidados incidentalmente.
2. Mantener identificadores/retención de recursos, incluidos TransactionsPOS y bucket; no reemplazar datos por reorganizar archivos. Fechas IAM como cadenas entre comillas.
3. Separar URLs activas del origen, ejemplos comentados y valores pendientes. Actualmente solo generación usa su URL stage activa en dev; el resto desconocido usa REPLACE_ME/.invalid. QA/prod no heredan stage.
4. El despliegue protegido rechaza dummies, dominios .invalid y credenciales en URLs. Las integraciones exigen HTTPS; la única excepción HTTP es openapiDevUrl en localhost, 127.0.0.1 o ::1.
5. Validar payload único antes del cliente AWS: sus cinco campos, cuponera_mx_credential sin prefijo Basic, jwt_clientSecret de al menos 48 bytes UTF-8 y rechazo de dummies REPLACE_ME/APISBX. La configuración SQL privada conserva puerto opcional entero 1–65535, numérico o cadena numérica. Conservar el rechazo de sustitución de AWSCURRENT salvo --replace y los permisos privados del archivo.
6. Transmitir GatewayLogsRoleArn como parámetro validado tanto al crear como al actualizar. El rol de logs de API Gateway es compartido por cuenta/región; no asumir propiedad exclusiva.
7. Las herramientas deben fallar ante errores de ejecución o respuestas inválidas. cfn-lint elimina el informe anterior al empezar; mantiene advertencias visibles sin suprimir reglas. ESLint bloquea también advertencias. El conteo de advertencias no se convierte en una excepción de seguridad.
8. Los valores públicos de despliegue son literales, sin resolutores. Conservar vacíos explícitos mediante --config nativo cuando el CLI --param de Framework 3 no los admite; limpiar la copia pública temporal. Comprobar/leer archivos privados sobre el mismo descriptor y rechazar fuentes SQL ambiguas.
9. Mantener pruebas de defaults/overrides por entorno, roles de logs, fechas IAM, carga de ZIP, bloqueo de publicación, carga/rotación de secretos y fallos de herramientas. Los tests con SDK/subprocesos simulados no acreditan funcionamiento AWS real.

## Evidencia y decisiones

El [contexto vigente](../context/README.md) resume la última ejecución registrada; la [revisión](../../docs/serverless-quality-review.md) distingue las pasadas y sus límites. [ADR 0005](../decisions/0005-modular-serverless-yaml.md) recoge la modularización; [ADR 0006](../decisions/0006-static-quality-checks.md), el análisis estático gradual y sus ajustes. Las versiones instaladas y comandos actuales se consultan en package.json, package-lock.json y requirements-dev.txt; no todas las versiones de herramientas instaladas son restricciones permanentes del usuario.
