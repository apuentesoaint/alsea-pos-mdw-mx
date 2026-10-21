# Skills

Este directorio reúne procedimientos reutilizables para tareas concretas. No hay skills registradas por ahora.

## Cómo añadir una skill

- Crea un directorio con la convención `<nombre>/SKILL.md`. Usa un nombre descriptivo en minúsculas, con guiones cuando sean necesarios.
- Sigue la [especificación Agent Skills](https://agentskills.io/specification). `SKILL.md` debe comenzar con metadatos YAML que incluyan `name`, coincidente con el nombre del directorio, y `description`, que explique qué hace la skill y cuándo usarla.
- Escribe las instrucciones en español e incluye los pasos y las verificaciones necesarios para ejecutar el procedimiento.
- Añade recursos auxiliares junto a la skill, por ejemplo en `references/`, `scripts/` o `assets/`, solo cuando sean necesarios, y enlázalos desde `SKILL.md`.
- Registra aquí un enlace a `SKILL.md`, una descripción breve y cuándo corresponde utilizarla.

El formato facilita la reutilización; el descubrimiento automático depende del agente. Si no lo admite, el agente puede localizar la skill en este índice y leer su `SKILL.md` manualmente. Lee solo las skills pertinentes y sus recursos necesarios.
