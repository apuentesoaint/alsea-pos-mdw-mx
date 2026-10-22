# Contexto del proyecto

Para modificar o ampliar funcionalidades, leer también la [guía de continuidad de desarrollo](development-handoff.md): requisitos del usuario, mapa de código/pruebas, particularidades HTTP, comandos y bloqueos. Última actualización de contexto: 2026-10-22; los resultados registrados corresponden a ejecuciones anteriores, no a una validación repetida por actualizar documentación.

## Hechos confirmados

- El repositorio se llama `prj-cuponera-back-mdw-sls`.
- Contiene una implementación TypeScript compilada previamente a ESM para Node.js 24 y AWS SDK v3 modular, con infraestructura en `serverless.yml` y Serverless Framework 3.40.0.
- Implementa el middleware Cuponera mediante API Gateway REST Regional y seis funciones Lambda, DynamoDB, S3, Secrets Manager, KMS, IAM y CloudWatch. Entornos dev/qa/prod en us-east-1.
- El usuario aprobó el [plan de migración](../specs/aws-migration.md) e indicó expresamente no descargar JDK ni ejecutar Java. La referencia se analiza solo estáticamente; sus hashes están en [source-baseline.json](../../docs/source-baseline.json).
- Se han ejecutado pruebas locales, comprobación de tipos, empaquetado y carga de ZIP en Node.js 24. No se han desplegado recursos ni migrado datos. Los límites están en [verification.md](../../docs/verification.md).
- La [revisión detallada](../../docs/review.md) corrigió diferencias de contratos, precisión, DTO, SDK, almacenamiento y alarmas. El [saneamiento posterior](../../docs/dependency-remediation.md) redujo la auditoría completa de 23 paquetes afectados (4 críticos) a 15 (0 críticos, 9 altos, 5 moderados y 1 bajo); producción sin avisos conocidos. CI y el despliegue bloquean la aceptación por los avisos residuales. No hay aprobación de corte productivo.
- La negociación Accept tiene pruebas estáticas por ruta y orden de efectos, cabeceras multivalor y catálogo tipado de 16 mensajes JVM; charset no UTF-8, excepciones secundarias y textos dependientes de JVM siguen sin certificación. Ver [HTTP](../../docs/http-parity.md).
- Hay 151 skills principales (149 de AWS, una de Git y una de patrones backend Node.js) instaladas localmente y registradas en `skills-lock.json`; el [catálogo](../skills/README.md) permite descubrirlas desde la entrada común. Su disponibilidad no fija la arquitectura del proyecto.

## Pendiente de definición

- Cuenta AWS, dominio/certificados, URLs reales y propietarios de secretos, sin incorporar valores sensibles al repositorio.
- Exportación SQL, zona horaria/intercalación y criterios operativos para empates de fecha.
- Validación contra entorno de referencia existente o fixtures aprobados, integraciones y JWT reales, despliegue y carga en qa, alarmas y recuperación.
- Canal de notificaciones y responsables de conciliación de canjes inciertos y corte.

## Bloqueos técnicos abiertos

- Cerrar los 15 avisos registrados de herramientas: tres causas raíz, sin excepciones de seguridad aprobadas. Los conteos deben renovarse al retomar el saneamiento; ver [dependencias](../../docs/dependency-remediation.md).
- Certificar las variantes HTTP pendientes sin ejecutar Java ni cambiar contratos implícitamente; ver [HTTP](../../docs/http-parity.md).
- No confundir verify funcional con auditoría completa ni empaquetado local con despliegue: la aceptación productiva continúa bloqueada.

## Entrada técnica

- [README](../../README.md): instalación Node.js 24, comandos y estructura.
- [Compatibilidad](../../docs/compatibility.md), [secretos](../../docs/secrets.md), [operación](../../docs/operations.md) y [migración](../../docs/migration.md).
- [Decisiones aceptadas](../decisions/README.md): arquitectura, persistencia y seguridad/observabilidad.
- [Continuidad de desarrollo](development-handoff.md): guía para cambios futuros, herramientas ESM, orden de efectos y evidencia pendiente.

## Cómo ampliar el contexto

Actualiza este documento al confirmar hechos o resolver aspectos pendientes. Si un tema requiere más detalle, crea un documento con nombre descriptivo en este directorio y enlázalo aquí. Registra los requisitos en [specs](../specs/README.md) y las decisiones técnicas con sus motivos en [decisions](../decisions/README.md).

- [Auditoría de acceso a skills](skills-audit.md): comprobaciones, resultados y límites de accesibilidad.
