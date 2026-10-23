# Secreto único de la API

Decisión confirmada por el usuario el 2026-10-23: DevOps creó manualmente `cuponera-api-security/dev/aws-mdw` en us-east-1. El proyecto consume ese recurso existente. CloudFormation ya no crea los cinco contenedores anteriores ni su clave KMS dedicada. No se copian valores de la conversación a código, documentación ni plantillas.

## Mapeo de campos

| Campo del secreto único | Uso en código |
| --- | --- |
| cuponera_mx_credential | Credencial de Cuponera; el adaptador añade el prefijo Basic una sola vez. |
| jwt_clientId | Identificador del consumidor en /auth/token; el contrato HTTP sigue usando clientId. |
| jwt_clientSecret | Credencial del consumidor en /auth/token y clave de firma JWT HS384, como bytes UTF-8; mínimo 48 bytes. |
| sbx_client | x-api-key y cálculo de firma del token Starbucks. |
| sbx_secret | client-secret y cálculo de firma del token Starbucks. |

El usuario confirmó reutilizar `jwt_clientSecret` para firmar JWT, aceptando invalidar los tokens anteriores. Se utiliza el texto completo en UTF-8, sin decodificar Base64 ni hexadecimal y sin requerir un sexto campo. Se conservan HS384, iat=exp y el contrato expiresIn; al validar se mantienen los algoritmos heredados HS256/HS384. La longitud mínima es de 48 bytes UTF-8. Una rotación de jwt_clientSecret cambia tanto el acceso como la firma y deja de aceptar tokens anteriores cuando cada entorno de ejecución renueva su caché; las credenciales permanecen vigentes en caché hasta 300 segundos.

Los valores Starbucks comunicados son marcadores APISBX_CLIENT/APISBX_SECRET: se rechazan al consumirlos y al cargar versiones. DevOps debe sustituirlos por credenciales operativas. Los consumidores validan únicamente sus campos al usarlos; autenticación no depende de que Starbucks esté configurado. El JSON no contiene conexión SQL; la migración se configura por separado mediante archivo privado.

## Infraestructura y permisos

`SECURITY_SECRET_ID` contiene únicamente el nombre del secreto. `securitySecretName` se configura en el principal y por defecto deriva el nombre por entorno: `cuponera-api-security/${sls:stage}/aws-mdw`. Solo dev está confirmado como existente; QA/prod deben crearse por DevOps o indicar su nombre expresamente. No reutilizar dev silenciosamente en otro entorno.

Los seis roles Lambda pueden leer el mismo secreto mediante GetSecretValue, con transporte seguro y ARN restringido al nombre, cuenta y región del stack. El sufijo `-??????` acota los seis caracteres aleatorios que AWS añade al ARN; no permite otros nombres. Al consolidar credenciales, IAM ya no puede separar el acceso por campos: cada Lambda autorizada puede leer el JSON completo.

El parámetro opcional `securitySecretKmsKeyArn` identifica una clave KMS administrada por el cliente. Con valor vacío no se concede kms:Decrypt propio (uso de aws/secretsmanager); si se configura, se limita a esa clave, Secrets Manager y el contexto de cifrado del secreto. DevOps debe confirmar el tipo de clave y habilitar su política. El stack no asume propiedad del secreto ni de su clave.

Si una versión anterior del stack llegó a desplegar los recursos retirados, sus políticas Retain dejan secretos y clave conservados fuera del stack. El cambio elimina su uso; no elimina físicamente esos recursos ni programa borrados. Inventariar y retirar recursos antiguos por el procedimiento operativo de DevOps tras validar el corte.

## Versiones, caché y rotación

DevOps conserva la carga y rotación del JSON completo. Las Lambdas solo leen; no crean versiones. Preparar cualquier archivo operativo fuera del repositorio con permisos 600. La herramienta de carga del proyecto debe validar el esquema único y rechazar marcadores y prefijos Basic antes de contactar AWS, sin mostrar contenido. Reemplazar AWSCURRENT requiere --replace y coordinación previa. No se carga automáticamente el secreto manual existente. El script exige los cinco campos, rechaza payloads antiguos, jwt_clientSecret menor de 48 bytes UTF-8, REPLACE_ME, marcadores APISBX y credencial con prefijo Basic. Conserva los campos adicionales que el operador incluya: no fusiona ni lee la versión anterior.

```sh
npm run secrets:put -- --id cuponera-api-security/dev/aws-mdw --file /ruta/privada/security.json --replace
```

Este comando es una referencia operativa para una rotación autorizada; no se ejecutó en esta entrega.

- Caché: 300 segundos por entorno de ejecución Lambda; las lecturas concurrentes del mismo identificador se agrupan.
- Cuponera conserva la vigencia expires_in del proveedor.
- Starbucks renueva cinco minutos antes de vencer y conserva el reintento de consulta tras 401.
- Tokens de proveedores permanecen en memoria, sin versiones de Secrets Manager por token.
- La rotación del secreto puede afectar conjuntamente autenticación y proveedores; coordinar las ventanas y la caché. La rotación KMS no rota las credenciales.

## Migración SQL y límites

El importador ya no usa un secreto SQL separado. Mantiene `--file` y la extracción mediante `--sql-config /ruta/privada/sql.json`, archivo local privado del operador. La política MigrationPolicy conserva exclusivamente DynamoDB/S3. Ver [migración](migration.md).

No se consultaron valores ni modificaron recursos AWS. Las comprobaciones locales no certifican IAM/KMS real, existencia de QA/prod, credenciales de proveedores ni rotación operativa.

Fuentes contrastadas: [políticas IAM de Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/auth-and-access_iam-policies.html), [estructura del ARN](https://docs.aws.amazon.com/secretsmanager/latest/userguide/whats-in-a-secret.html) y [cifrado KMS](https://docs.aws.amazon.com/secretsmanager/latest/userguide/security-encryption.html).

## Comprobación inicial del cambio (2026-10-23)

`npm run verify` aprobado: ESLint, TypeScript estricto, 134 pruebas, empaquetado dev, cfn-lint (cero errores, siete advertencias existentes), inspección/carga de seis ZIP ESM, simulación funcional con SDK v3 e integridad. Las regresiones verifican una sola lectura SDK compartida por autenticación y ambos proveedores, firma UTF-8, rechazo de la clave anterior, rotación, esquemas antiguos, dummies, AWSCURRENT/--replace e IAM/KMS. Se corrigió una comparación de URL de token en el fixture para admitir el query grant_type antes de la ejecución aprobada.

La matriz de empaquetado dev/qa/prod y cfn-lint aprobó los tres entornos (cero errores y siete advertencias por plantilla). Se inspeccionaron las seis variables Lambda y los seis roles: nombre independiente por entorno y permisos al secreto único. QA ejercitó securitySecretKmsKeyArn con un ARN ficticio de prueba; prod ejercitó su valor vacío. Solo dev repitió carga de ZIP y simulación funcional en esta consolidación. Se regeneró el paquete dev al terminar la matriz para dejar los artefactos e integridad vigentes.

No se repitió la auditoría de dependencias (su bloqueo anterior sigue vigente). cfn-guard/guardpycfn y reglas de compliance no están disponibles; no se certifica compliance. La validación de servicio de CloudFormation, políticas KMS reales, integraciones externas y despliegue quedan pendientes.

## Revisión posterior en detalle

La verificación posterior aprobó 146 pruebas y empaquetado/cfn-lint/seis ZIP/simulación en dev/qa/prod. La [revisión detallada](single-secret-review.md) registra los defectos encontrados y corregidos, la inspección por archivo, la matriz de casos y la evidencia actual. Rechazar espacios exteriores sin normalizar los cinco campos y verificar compatibilidad con Headers en los campos de proveedores. El lector privado comprueba permisos/tipo y lee el mismo descriptor; acepta lectura exclusiva del propietario, incluidos modos 600/400 en POSIX.

El despliegue usa --config nativo y un JSON temporal de configuración pública cuando hay parámetros vacíos, porque Serverless 3.40.0 rechaza --param=key=. Conserva los vacíos expresos y las rutas de módulos YAML; elimina la copia al terminar o fallar por excepción; una terminación forzada puede dejar el archivo público ignorado y requerir su limpieza. Los valores del archivo público deben ser literales, sin resolutores de variables/secretos. El YAML original no se modifica. La auditoría renovada registra dos avisos bajos en herramientas y ninguno en producción, y continúa bloqueando.
