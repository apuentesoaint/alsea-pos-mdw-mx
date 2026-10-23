# Especificaciones

Este directorio reúne requisitos y criterios de aceptación de funcionalidades.

- [Migración AWS de Cuponera](aws-migration.md): requisitos acordados; implementación local y aceptación operativa pendiente.
- [Infraestructura modular y controles de calidad](serverless-infrastructure-and-quality.md): requisitos confirmados en este chat, invariantes de YAML/configuración y validación; aceptación AWS pendiente.
- [Saneamiento de dependencias](../../docs/dependency-remediation.md) y [compatibilidad HTTP](../../docs/http-parity.md): ejecución del plan aprobado, verificaciones y bloqueos residuales.

- [Secreto único de DevOps](../../docs/secrets.md): consolidación solicitada y firma con jwt_clientSecret confirmada; decisión en [ADR 0007](../decisions/0007-single-devops-security-secret.md).

- [Revisión del secreto único](../../docs/single-secret-review.md): inspección por archivo, correcciones de casos límite y resultados locales; aceptación AWS pendiente.

## Cómo añadir una especificación

Crea un archivo Markdown con nombre descriptivo en inglés y contenido en español. Describe el objetivo, el comportamiento esperado, los límites del cambio y criterios de aceptación verificables. Incluye contratos de entrada y salida cuando apliquen y señala las preguntas pendientes.

Indica el estado de la especificación, distinguiendo propuestas de requisitos acordados, y enlaza las [decisiones](../decisions/README.md) o [referencias](../references/README.md) pertinentes. Registra aquí el enlace, una descripción breve y su estado. Mantén el documento actualizado si cambian los requisitos.
