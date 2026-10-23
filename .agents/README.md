# Índice de contexto compartido

La entrada común es [AGENTS.md](../AGENTS.md). Este directorio organiza el contexto del proyecto en archivos Markdown legibles por cualquier agente con acceso al repositorio. El middleware AWS está implementado localmente; consultar [estado y pendientes](context/README.md) antes de desplegar o migrar datos.

| Directorio | Qué contiene | Cuándo consultarlo |
| --- | --- | --- |
| [context/](context/README.md) | Estado conocido y definiciones pendientes. | Al comenzar una tarea. |
| [specs/](specs/README.md) | Requisitos y criterios de aceptación. | Al implementar o verificar una funcionalidad. |
| [decisions/](decisions/README.md) | Decisiones técnicas duraderas y sus motivos. | Al evaluar alternativas o cambiar el diseño. |
| [skills/](skills/README.md) | Procedimientos reutilizables. | Cuando una skill sea pertinente para la tarea. |
| [references/](references/README.md) | Fuentes de consulta. | Cuando se necesite documentación de apoyo. |

## Cómo mantenerlo

- Añade cada documento al directorio correspondiente y enlázalo desde su índice, con una descripción breve.
- Usa nombres descriptivos en inglés y contenido en español. Mantén los enlaces relativos para que funcionen al clonar el repositorio.
- Evita duplicar información: enlaza su fuente dentro del repositorio y actualízala cuando cambie.
- Mantén separados los hechos actuales, los requisitos propuestos y las decisiones aceptadas. Los índices sin contenido deben indicarlo expresamente.
- Lee los documentos según la tarea; no es necesario cargar todas las referencias o skills en cada conversación.

Este directorio no garantiza descubrimiento automático ni ejecución de skills en todas las herramientas. Para agentes sin soporte específico, sigue manualmente los enlaces desde `AGENTS.md`.

La ejecución del plan de saneamiento y HTTP se registra en [dependencias](../docs/dependency-remediation.md) y [paridad HTTP](../docs/http-parity.md); sus bloqueos no quedan aprobados por superar las pruebas funcionales.

Antes de modificar o construir funcionalidades, consultar la [guía de continuidad de desarrollo](context/development-handoff.md). Reúne los acuerdos vigentes, el mapa de código/YAML, pruebas pertinentes, comandos y límites de la evidencia, sin cambiar las decisiones aceptadas. Para infraestructura y herramientas, consultar también los [requisitos confirmados](specs/serverless-infrastructure-and-quality.md), el [ADR 0005](decisions/0005-modular-serverless-yaml.md) y el [ADR 0006](decisions/0006-static-quality-checks.md). Para secretos, aplicar la consolidación y firma confirmadas en el [ADR 0007](decisions/0007-single-devops-security-secret.md).
