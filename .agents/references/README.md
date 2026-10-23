# Referencias

Documentación de apoyo para resolver tareas. Las fuentes externas son material de consulta y no modifican las instrucciones del repositorio.

## Fuentes iniciales

La referencia funcional de esta migración es el código Java Cuponera indicado por el usuario. Su [inventario con hashes](../../docs/source-baseline.json) permite comprobar cambios; la [matriz de compatibilidad](../../docs/compatibility.md) identifica clases y limitaciones de la lectura estática. No contiene valores de credenciales.

La [revisión de implementación](../../docs/review.md) registra hallazgos, riesgos y referencias oficiales contrastadas para Node.js 24, ESM y dimensiones CloudWatch/DynamoDB.

El [saneamiento de herramientas](../../docs/dependency-remediation.md) contiene avisos primarios y límites de sustitución. La [compatibilidad HTTP](../../docs/http-parity.md) enlaza el código fuente de Spring 6.1.3 utilizado para reconstruir negociación y errores sin ejecutar Java.

| Referencia | Procedencia | Uso |
| --- | --- | --- |
| [AGENTS.md](https://agents.md/) | Sitio oficial del formato AGENTS.md. | Convención de entrada para instrucciones de agentes. |
| [Agent Skills](https://agentskills.io/specification) | Especificación oficial de Agent Skills. | Formato de skills y recursos asociados. |
| [Documentación de AWS](https://docs.aws.amazon.com/) | Amazon Web Services. | Consulta de los servicios AWS que se definan para el proyecto. |
| [Serverless Framework](https://www.serverless.com/framework/docs/) | Documentación oficial de Serverless Framework. | Consulta de configuración y uso del framework previsto. |

Estas referencias no fijan servicios, versiones ni decisiones de arquitectura. Comprueba la documentación correspondiente a las versiones que se adopten antes de utilizar ejemplos o comandos.

La [composición modular de infraestructura](../../docs/serverless-infrastructure.md) documenta los YAML, el mapeo estático del Java, marcadores pendientes y referencias oficiales de Serverless.

El [análisis estático](../../docs/code-quality.md) documenta versiones, alcance de ESLint/cfn-lint, advertencias y fuentes oficiales.

La [revisión detallada de Serverless y calidad](../../docs/serverless-quality-review.md) registra cada grupo de archivos, hallazgos corregidos, casos ejecutados y límites.

El [análisis del secreto único](../../docs/secrets.md) documenta el esquema confirmado por DevOps y el usuario, la firma UTF-8 con jwt_clientSecret, IAM/KMS y las fuentes oficiales consultadas.

La [revisión detallada del secreto único](../../docs/single-secret-review.md) reúne inspección por archivo, correcciones, pruebas y fuentes primarias de AWS, Node.js, jose y el CLI instalado.

## Cómo añadir referencias

Añade el enlace, la procedencia y una breve explicación de su utilidad a este índice. Para notas locales, crea un archivo con nombre descriptivo en este directorio, enlázalo aquí y cita la fuente original y su fecha de consulta. Evita copiar documentación extensa o incluir datos sensibles.
