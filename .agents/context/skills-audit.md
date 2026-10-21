# Auditoría de acceso a skills

Fecha: 2026-10-21.

## Hallazgos y correcciones

Había 149 skills principales instaladas y 149 entradas en el lock, pero el índice de skills afirmaba que no existían procedimientos registrados. Se sustituyó ese índice por un catálogo completo con enlaces relativos y criterios de selección. Se explicitó en `AGENTS.md` la lectura manual para agentes sin soporte nativo y se actualizó el contexto del proyecto.

Los adaptadores de Claude, Gemini y Copilot ya remitían a `AGENTS.md`; se conservaron. El README raíz también ofrece esa entrada para cualquier otra herramienta. No se modificaron las skills de terceros ni su lock.

## Comprobaciones y resultado

Se ejecutó `python3 .agents/scripts/audit_skills.py` desde la raíz:

- 149 skills principales legibles, con nombre coincidente y descripción en su cabecera.
- Correspondencia exacta de nombres entre instalación, lock y catálogo.
- Recursos locales legibles y ausencia de enlaces simbólicos rotos.
- Enlaces locales de los documentos de entrada, catálogo y contexto auditados existentes.
- Rutas Claude, Gemini y Copilot → `AGENTS.md` → catálogo verificadas.
- Un `SKILL.md` anidado de OpenClaw identificado y enlazado como recurso auxiliar de `agents-pay`.

## Alcance de la certificación

Se certifica la accesibilidad documental local mediante las comprobaciones anteriores para un agente con permisos de lectura del repositorio que siga la entrada común. El resultado es reproducible con el verificador y corresponde al estado de esta auditoría.

No se certifica el descubrimiento automático en todos los productos ni la ejecución de las 149 skills: cada herramienta controla sus instrucciones y puede requerir CLI, MCP, credenciales, permisos o conectividad adicionales. No se ejecutaron operaciones AWS, instalaciones, despliegues ni pruebas de integración con agentes externos. Tampoco se validaron todos los enlaces internos o externos del contenido de terceros ni sus requisitos operativos. Las skills personales o de plugins instaladas fuera del repositorio no forman parte de este inventario compartido.
