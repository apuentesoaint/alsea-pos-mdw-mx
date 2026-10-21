# Índice de contexto compartido

La entrada común es [AGENTS.md](../AGENTS.md). Este directorio organiza el contexto del proyecto en archivos Markdown legibles por cualquier agente con acceso al repositorio.

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
