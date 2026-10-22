# Secretos y credenciales

Secretos por entorno, cifrados con KMS y retenidos al reemplazar/eliminar recursos. Los templates crean contenedores sin versiones ni contraseñas aleatorias que los proveedores desconozcan.

| Output | Campos JSON que carga el propietario |
| --- | --- |
| AuthSecretArn | clientId, clientSecret |
| SigningSecretArn | keyBase64; al menos 48 bytes decodificados para HS384 |
| CuponeraSecretArn | basic, sin prefijo Basic |
| StarbucksSecretArn | clientId, clientSecret |
| MigrationSecretArn | host, port, dbname, username, password; SQL Server con TLS |

La firma inicial debe proceder de la referencia si se necesita aceptar sus tokens durante el corte. No se interpreta la clave como hexadecimal ni se reemplaza silenciosamente.

## Cargar versiones

Preparar un archivo JSON fuera del repositorio con permisos 600. Usar un rol temporal con permisos DescribeSecret/PutSecretValue y uso de la clave KMS:

```sh
npm run secrets:put -- --kind signing --arn ARN_DEL_SECRETO --file /ruta/privada/signing.json
```

El script no muestra contenido. Rechaza sustituir AWSCURRENT salvo `--replace`, que debe utilizarse después de coordinar rotación. No copiar archivos sensibles al repositorio ni cargar valores desde la conversación.

Las Lambdas solo leen sus ARN concretos y usan kms:Decrypt mediante Secrets Manager; no crean versiones. El secreto SQL no está disponible para ninguna Lambda.

## Caché y rotación

- Secretos: 300 segundos por entorno de ejecución, agrupando lecturas concurrentes.
- Cuponera: vigencia expires_in del origen.
- Starbucks: renovación cinco minutos antes de vencer y un reintento de consulta después de 401.
- Tokens externos solo en memoria; no crear versiones de secretos por cada token.
- Coordinar credenciales con proveedores. Rotar KMS no rota sus contraseñas.
- Conservar la firma JWT durante el corte. Esta entrega no acepta automáticamente una segunda clave; coordinar la ventana de renovación antes de sustituirla.

## Hallazgos

La referencia contiene firma JWT incrustada, credenciales comentadas y claves AWS en settings.xml. El manifiesto señala archivos/líneas sin valores. El propietario debe sustituir y revocar el acceso AWS de Maven; no se traslada a Lambda. Application Insights se retira del middleware AWS.

Antes de producción, verificar CloudTrail, KMS y recuperación/rotación. No se cargaron versiones ni se consultaron valores reales de Secrets Manager durante la implementación.
