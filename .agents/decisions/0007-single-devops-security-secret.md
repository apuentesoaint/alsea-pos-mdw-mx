# 0007 — Secreto único administrado por DevOps

Fecha: 2026-10-23. Estado: aceptada por solicitud explícita del usuario, incluida la reutilización de jwt_clientSecret para la firma y la invalidación de JWT anteriores.

## Contexto

El diseño anterior declaraba cinco secretos independientes y una clave KMS en CloudFormation. DevOps creó manualmente un secreto único para dev: `cuponera-api-security/dev/aws-mdw`, en us-east-1. El usuario indicó retirar los demás usos y reutilizar los campos de este JSON, sin copiar sus valores al repositorio.

## Decisión

Consumir el secreto externo mediante `SECURITY_SECRET_ID`. Configurar su nombre desde `securitySecretName`, separado por entorno; no heredar dev en QA/prod. Usar los campos cuponera_mx_credential, jwt_clientId, jwt_clientSecret, sbx_client y sbx_secret en sus respectivos consumidores. Conservar el contrato HTTP clientId/clientSecret y los formatos de cabeceras de proveedores.

Retirar los contenedores de secretos y la clave KMS dedicada del stack, sus referencias y outputs antiguos. Restringir GetSecretValue al nombre del secreto, cuenta y región, usando seis comodines de un carácter para el sufijo AWS. Conservar cliente SDK v3, caché de 300 segundos y agrupación concurrente. Autorizar opcionalmente una clave KMS externa concreta, limitada por servicio y contexto de cifrado; no asumir su existencia ni propiedad.

El JSON comunicado no incluye conexión SQL. Retirar la lectura del secreto SQL del importador, conservar --file y permitir extracción desde --sql-config con archivo privado de permisos 600. MigrationPolicy conserva únicamente los permisos DynamoDB/S3 necesarios.

## Firma JWT confirmada

El usuario seleccionó expresamente cambiar la firma para reutilizar jwt_clientSecret, aceptando invalidar los JWT actuales. Se utiliza el texto íntegro como UTF-8 y se exige un mínimo de 48 bytes para HS384; no se decodifica como Base64 ni hexadecimal, ni se añade otro campo al JSON. La firma anterior, independiente, deja de utilizarse. Se conservan los claims y formatos HTTP existentes. La validación mantiene los algoritmos heredados HS256/HS384.

Rotar jwt_clientSecret cambia simultáneamente credencial y firma. Los entornos Lambda con la versión anterior en caché pueden mantenerla hasta 300 segundos; coordinar el corte y solicitar un nuevo token tras renovar la caché. La longitud mínima no demuestra entropía; DevOps debe generar credenciales apropiadas por su canal seguro.

## Alternativas y motivos

Mantener los cinco contenedores contradice la decisión de DevOps y la solicitud del usuario. Importar el secreto a CloudFormation alteraría su propiedad innecesariamente. Inyectar sus valores en variables Lambda o resolverlos al empaquetar expondría credenciales y perjudicaría la rotación; se mantiene la recuperación en ejecución.

## Consecuencias

Cada rol autorizado puede leer todo el JSON: Secrets Manager no restringe IAM por campo. La rotación requiere coordinar consumidores de autenticación y proveedores. QA/prod y la clave KMS externa requieren confirmación operativa. Los recursos antiguos que ya hubieran sido desplegados quedan retenidos al retirarlos del stack; su borrado físico corresponde a DevOps después del corte, sin programarlo en este cambio.

Esta decisión sustituye solo la separación/propiedad de secretos y KMS de [ADR 0003](0003-secrets-and-observability.md); conserva su recuperación en ejecución y observabilidad. Actualiza las reglas de retención/payloads del [requisito de infraestructura](../specs/serverless-infrastructure-and-quality.md) para los recursos retirados. No autoriza despliegues ni valida AWS real.

## Precisiones de la revisión posterior del 2026-10-23

La [revisión](../../docs/single-secret-review.md) mantiene la decisión de firma, haciendo explícito que quien posee la credencial puede emitir JWT. La política heredada de claims no se endurece silenciosamente; no se declara separación entre consumidor y emisor ni aceptación productiva.

Los archivos privados se validan y leen sobre el mismo descriptor; se rechazan fuentes SQL ambiguas y credenciales con espacios exteriores o incompatibles con cabeceras. El despliegue conserva los valores vacíos usando --config nativo de Framework 3 con una copia JSON pública temporal en la raíz; la alternativa de omitirlos perdería overrides explícitos. Se limpia en finally y se rechazan resolutores en valores públicos. No se modifica el framework ni los YAML fuente. La copia temporal no contiene valores de Secrets Manager.
