# 0001 — Handlers Lambda nativos y ESM

Fecha: 2026-10-22. Estado: aceptada en el plan solicitado por el usuario.

## Contexto y decisión

El origen contiene controladores Spring y servicios; no contiene un servidor Express reutilizable. Se elige API Gateway REST Regional con handlers Lambda separados por operación, lógica compartida dentro del paquete y procesamiento síncrono. Node.js 24, SDK v3 modular y ESM nativo son requisitos no negociables.

## Alternativas y motivos

Express/Fastify añade adaptación HTTP y dependencias sin aprovechar código del origen. Un único handler concentraría permisos y escalado. HTTP API cuesta menos, pero REST permite Gateway Responses y logs de ejecución requeridos. Colas y llamadas entre Lambdas modificarían los contratos síncronos y agregarían latencia.

El código TypeScript se compila antes de desplegar, con esbuild a node24/ESM y extensión .mjs. No se usan loaders TypeScript. Un plugin local ESM amplía exclusivamente el enum del runtime de Framework 3.40.0; mantiene validación estricta. YAML se resuelve a su distribución ESM en el bundle porque su entrada Node introduce require dinámico incompatible.

## Consecuencias

Cada operación tiene rol y artefacto propio. El router compartido conserva autenticación y errores del origen. Rutas ANY adicionales permiten que los métodos alternativos alcancen esa frontera y no reciban un error genérico de API Gateway. El contenido común aumenta algo el paquete, a cambio de una sola implementación contractual. Los ZIP se cargan realmente en Node.js 24 antes de aceptar el empaquetado.

La validación reproduce coerciones y mensajes de DTO de Jackson/Bean Validation mediante reglas explícitas. Un esquema genérico estricto cambiaría la aceptación de números, booleanos, campos opcionales y null; emplear una biblioteca seguiría requiriendo adaptaciones específicas. Esta elección exige caracterización y regresiones detalladas, reforzadas durante la revisión, y no elimina la necesidad de validar variantes de Spring todavía no caracterizadas.
