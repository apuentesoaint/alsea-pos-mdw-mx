# Decisiones técnicas

Este directorio registra decisiones técnicas duraderas y sus motivos.

| Decisión | Estado |
| --- | --- |
| [0001 — Handlers Lambda nativos y ESM](0001-native-lambda-esm.md) | Aceptada |
| [0002 — Persistencia consistente](0002-consistent-transaction-storage.md) | Aceptada |
| [0003 — Secretos y observabilidad](0003-secrets-and-observability.md) | Sustituida parcialmente por 0007 para propiedad/separación de secretos; observabilidad vigente |
| [0004 — Adaptadores ESM y compatibilidad HTTP](0004-toolchain-adapters-and-http-parity.md) | Aceptada; cierre de seguridad y paridad pendientes |
| [0005 — Infraestructura modular en YAML](0005-modular-serverless-yaml.md) | Aceptada |
| [0006 — Análisis estático y validación de CloudFormation](0006-static-quality-checks.md) | Aceptada |
| [0007 — Secreto único administrado por DevOps](0007-single-devops-security-secret.md) | Aceptada; secreto único y firma con jwt_clientSecret |

## Cómo añadir una decisión

Crea un archivo Markdown con nombre `NNNN-short-title.md`, comenzando por `0001` y continuando de forma secuencial. Escribe el contenido en español e incluye título, fecha en formato `YYYY-MM-DD`, estado, contexto, decisión, motivo y consecuencias. Documenta las alternativas relevantes cuando las haya.

Usa los estados `propuesta`, `aceptada`, `rechazada` o `sustituida`, según corresponda. No marques una propuesta como aceptada sin que exista una decisión confirmada. Si una decisión aceptada cambia, conserva el registro anterior, márcalo como sustituido y enlaza la nueva decisión.

Registra aquí el enlace, una descripción breve y su estado. Actualiza también el [contexto del proyecto](../context/README.md) si la decisión cambia los hechos vigentes.
