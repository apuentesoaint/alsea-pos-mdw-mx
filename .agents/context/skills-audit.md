# Auditoría de acceso a skills

Fecha: 2026-10-22.

## Hallazgos y correcciones

Se encontraron 151 skills principales instaladas y 151 entradas en `skills-lock.json`. El catálogo y el contexto todavía declaraban 149: faltaban las rutas de `git` y `nodejs-backend-patterns`. Se añadieron sus enlaces y criterios de selección, se actualizaron los totales y se distinguieron sus tres fuentes de procedencia.

Las entradas de Claude, Gemini y Copilot remiten a `AGENTS.md`; el README raíz ofrece además un mensaje de inicio manual para otras herramientas. Se conservaron estas entradas y las instrucciones compartidas. Se preservaron las dos instalaciones nuevas y los cambios preexistentes del lock, sin modificar contenido de terceros.

Se reforzó el verificador para detectar diferencias y duplicados entre las filas del catálogo y las instalaciones, totales incorrectos, documentos de contexto ausentes y rutas incompletas desde el README raíz y el índice compartido.

`nodejs-backend-patterns` menciona `javascript-testing-patterns`, que no está instalada. El catálogo explicita esa limitación. No se instalaron dependencias adicionales. No se realizó un inventario exhaustivo de dependencias operativas o menciones a otras skills dentro de todo el contenido de terceros.

## Comprobaciones y resultado

Comando reproducible desde la raíz:

```sh
python3 .agents/scripts/audit_skills.py
```

Resultado final: 151 skills principales, 151 entradas del lock y cero errores.

- Correspondencia exacta de nombres entre instalación, lock y filas del catálogo, sin duplicados.
- Las 151 skills tienen archivos legibles, nombre coincidente y descripción en la cabecera.
- Recursos locales legibles y ausencia de enlaces simbólicos rotos.
- Enlaces locales existentes en los documentos propios de entrada, índices y contexto auditados.
- Rutas README, Claude, Gemini y Copilot → `AGENTS.md` → índice compartido y catálogo verificadas.
- Un `SKILL.md` auxiliar de OpenClaw identificado y enlazado como recurso anidado de `agents-pay`.

## Alcance de la certificación

Se certifica la accesibilidad documental local de las 151 skills para cualquier agente capaz de leer el repositorio y seguir la entrada común, incluso mediante lectura manual sin soporte nativo de skills. La certificación corresponde al estado local auditado; debe repetirse después de instalar o retirar skills.

No se certifica el descubrimiento automático en todos los productos ni la ejecución funcional de las 151 skills: cada herramienta controla sus instrucciones y puede requerir CLI, MCP, credenciales, permisos o conectividad adicionales. No se ejecutaron operaciones AWS, instalaciones, despliegues ni pruebas de integración con agentes externos. Tampoco se validaron todos los enlaces internos o externos del contenido de terceros, toda su semántica YAML, sus hashes de procedencia ni sus requisitos operativos. Las skills personales o de plugins instaladas fuera del repositorio no forman parte de este inventario compartido.

Las dos instalaciones nuevas y la modificación del lock estaban sin confirmar en Git al comenzar la auditoría. Su disponibilidad en otros clones requiere que esos archivos se incorporen y distribuyan junto con el contexto actualizado.
