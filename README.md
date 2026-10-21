# prj-cuponera-back-mdw-sls

Repositorio destinado a un proyecto serverless en AWS con Serverless Framework y un futuro fichero `serverless.yml`. Actualmente contiene únicamente la estructura documental de contexto para agentes de IA.

## Inicio para agentes

Lee [AGENTS.md](AGENTS.md) y sigue su recorrido de contexto antes de trabajar.

Si tu herramienta no descubre las instrucciones automáticamente, utiliza este mensaje al iniciar la conversación:

> Lee `AGENTS.md` y sigue su recorrido de contexto antes de trabajar.

El descubrimiento automático depende del agente y de su configuración. Cualquier agente con acceso a los archivos puede seguir el recorrido manual.

## Organización

| Ubicación | Propósito |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Entrada común e instrucciones compartidas. |
| [.agents/](.agents/README.md) | Índice del contexto y guía de mantenimiento. |
| [.agents/context/](.agents/context/README.md) | Hechos conocidos y aspectos pendientes del proyecto. |
| [.agents/skills/](.agents/skills/README.md) | Procedimientos reutilizables para tareas concretas. |
| [.agents/references/](.agents/references/README.md) | Documentación de consulta y fuentes externas. |
| [.agents/specs/](.agents/specs/README.md) | Requisitos y criterios de aceptación. |
| [.agents/decisions/](.agents/decisions/README.md) | Decisiones técnicas y sus motivos. |

[CLAUDE.md](CLAUDE.md), [GEMINI.md](GEMINI.md) y [.github/copilot-instructions.md](.github/copilot-instructions.md) son adaptadores mínimos que remiten a la entrada común. Las instrucciones y el contexto se mantienen en una única fuente.

La documentación se mantiene en español, con nombres de archivos y carpetas en inglés. El lenguaje, runtime, arquitectura, servicios AWS y comandos de desarrollo siguen pendientes de definición.
