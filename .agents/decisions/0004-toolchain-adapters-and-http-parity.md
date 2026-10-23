# 0004 — Adaptadores ESM de herramientas y compatibilidad HTTP

Fecha: 2026-10-22. Estado: aceptada por la ejecución del plan y la selección expresa de adaptación ESM.

## Decisión y fundamento

Mantener versiones exigidas de Framework, bundler y runtime. Actualizar dependencias transitivas mediante overrides bloqueados; adaptar interfaces incompatibles conocidas en un preload ESM de Node.js 24, limitado a tres consumidores de terceros con hash exacto. No modificar instalaciones en disco ni introducir envoltorios CommonJS propios. El hash convierte una actualización inesperada en fallo explícito y revisable.

Se descartan actualización forzada de Framework, desactivación del audit y eliminación nominal de avisos mediante renombrado. Las sustituciones utilizan implementaciones corregidas y pruebas sobre consumidores reales. Los avisos sin solución equivalente demostrada continúan bloqueando aceptación y despliegue; no se autorizan excepciones implícitas.

La negociación HTTP pertenece al transporte compartido y utiliza reglas derivadas del Spring efectivo, preservando seguridad y orden de efectos. Un framework web adicional no reproduce automáticamente las decisiones de Spring y agregaría adaptación y dependencias. Las particularidades q=0 y escritura posterior al negocio se conservan por paridad.

## Consecuencias

Usar los comandos npm que cargan el preload; mantener sus hashes y pruebas al actualizar terceros. Verificación funcional y seguridad se ejecutan separadamente en CI, con manifiesto SHA-256 del paquete. Mensajes JVM centralizados y casos HTTP estáticos no se presentan como paridad certificada. Los límites y avisos residuales permanecen explícitos en [dependencias](../../docs/dependency-remediation.md) y [HTTP](../../docs/http-parity.md).
