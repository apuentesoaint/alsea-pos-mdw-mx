# Contexto del proyecto

## Hechos confirmados

- El repositorio se llama `prj-cuponera-back-mdw-sls`.
- Actualmente contiene documentación de contexto para agentes de IA; todavía no contiene código de aplicación ni infraestructura.
- Está destinado a un proyecto serverless en AWS que utilizará Serverless Framework y el fichero `serverless.yml`.
- `serverless.yml` aún no existe.
- Hay 151 skills principales (149 de AWS, una de Git y una de patrones backend Node.js) instaladas localmente y registradas en `skills-lock.json`; el [catálogo](../skills/README.md) permite descubrirlas desde la entrada común. Su disponibilidad no fija la arquitectura del proyecto.

## Pendiente de definición

- Objetivos funcionales, reglas de negocio y contratos de integración.
- Lenguaje de programación, runtime y versiones de herramientas.
- Arquitectura y servicios AWS concretos.
- Entornos, regiones y estrategia de despliegue.
- Gestión de dependencias y comandos de instalación, ejecución, pruebas y despliegue.

## Cómo ampliar el contexto

Actualiza este documento al confirmar hechos o resolver aspectos pendientes. Si un tema requiere más detalle, crea un documento con nombre descriptivo en este directorio y enlázalo aquí. Registra los requisitos en [specs](../specs/README.md) y las decisiones técnicas con sus motivos en [decisions](../decisions/README.md).

- [Auditoría de acceso a skills](skills-audit.md): comprobaciones, resultados y límites de accesibilidad.
