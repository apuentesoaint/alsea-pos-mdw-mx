# Compatibilidad HTTP: negociación y errores

Fecha: 2026-10-22. Referencia: código de Cuponera y Spring Framework 6.1.3 de su línea Spring Boot 3.2.2. Método exclusivamente estático; no se ejecuta Java ni se descargan JDK.

## Comportamientos implementados

| Grupo | Regla y evidencia |
| --- | --- |
| Seguridad | La autenticación conserva precedencia. Accept inválido no sustituye un 401 vacío por un 406. |
| Healthcheck | El mapping declara produces JSON; se negocia antes del controlador. Conserva texto sin comillas JSON. |
| DTO de negocio y token | Se negocian al escribir el resultado. Validate puede guardar y redeem puede confirmar antes de un 406. No se reenvía el canje ni se revierte una escritura por ese resultado. |
| Cabeceras | Comparación sin distinción de mayúsculas. multiValueHeaders sustituye su representación simple; no duplica los mismos valores. |
| Representaciones | JSON, vendor +json, comodines, prioridades, parámetros y valores entrecomillados. Se conserva orden parcial estable de Spring. |
| q=0 | Spring 6.1.3 no filtra q=0 en el recorrido reconstruido; se conserva esa particularidad. No aplicar una interpretación RFC distinta silenciosamente. |
| Sintaxis ilegible | 406 con detalle `Could not parse Accept header.`. Al serializar un error, Spring omite el cuerpo si no puede interpretar Accept. |
| Sin representación | 406 y lista de representaciones admitidas; los ProblemDetail disponen de fallback application/problem+json. |
| Texto | test-insights utiliza el comportamiento StringHttpMessageConverter: el cuerpo sigue siendo literal al seleccionar JSON o XML. No se inventa un objeto JSON ni un documento XML. |
| Documentación | Mapping JSON/YAML para los endpoints conocidos. Los recursos estáticos conservan su tipo y no se someten a la política de los DTO. |
| HEAD/OPTIONS | HEAD elimina el cuerpo después de negociación; OPTIONS conserva las reglas previas y Allow. |

Las pruebas verifican también las llamadas al proveedor y la persistencia posterior al resultado HTTP. Las expectativas de `test/negotiation.test.ts` proceden de código fuente; no son fixtures capturados de Java.

## Mensajes

Los 16 textos de errores por nulos ya reconstruidos se centralizan en `src/core/legacy-errors.ts`, con códigos internos y un error tipado. No se cambia su mensaje público. Centralizarlos no demuestra que sean idénticos a todos los mensajes generados por una JVM: varios dependen del bytecode, nombres de variables, opciones de ejecución y versión exacta.

Se conservan los literales del negocio, JSON inválido, validación, persistencia y filtros de mensajes técnicos. Los nuevos textos 406 se derivan de HttpMediaTypeNotAcceptableException. No se transforman excepciones inesperadas de JavaScript mediante sustituciones textuales generales que inventen una causa Java.

## Límites que mantienen bloqueada la certificación total

- Redacción exacta de NPE, errores de conversión y orden de múltiples errores Bean Validation no determinados por los archivos disponibles.
- Recorridos donde una excepción del negocio coincide con Accept incompatible y falla también el @ExceptionHandler; la resolución secundaria y el contenedor deben tratarse como pendientes, aunque exista una respuesta local determinista.
- Charset distintos de UTF-8, codificaciones de bytes del convertidor y negociación binaria real de API Gateway. El transporte conserva UTF-8, omite el parámetro de otra codificación y registra HttpParityGaps/http.charset-not-certified; evita anunciar bytes UTF-16 o Latin-1 sin producirlos. Esta conservación del transporte previo es una diferencia explícita pendiente, no una implementación certificada de esos charset.
- Cabeceras y errores producidos antes de Lambda por API Gateway o por el frontal Java.
- Salida exacta de springdoc, negociación de representaciones no usadas por los casos cubiertos, conjuntos extremos de candidatos y sintaxis MIME exótica dependiente de las bibliotecas.

No hay autorización para sustituir estos mensajes por un contrato nuevo. Sin ejecutar Java, solo pueden cerrarse casos cuyo resultado se determine de las fuentes o de evidencia existente aprobada. No se afirma paridad ejecutada Java/AWS ni se habilita el corte por aprobar pruebas locales.

## Fuentes primarias

- [AbstractMessageConverterMethodProcessor 6.1.3](https://github.com/spring-projects/spring-framework/blob/v6.1.3/spring-webmvc/src/main/java/org/springframework/web/servlet/mvc/method/annotation/AbstractMessageConverterMethodProcessor.java): momento de escritura, selección y fallback ProblemDetail.
- [ProducesRequestCondition 6.1.3](https://github.com/spring-projects/spring-framework/blob/v6.1.3/spring-webmvc/src/main/java/org/springframework/web/servlet/mvc/condition/ProducesRequestCondition.java): selección del mapping.
- [HeaderContentNegotiationStrategy](https://github.com/spring-projects/spring-framework/blob/v6.1.3/spring-web/src/main/java/org/springframework/web/accept/HeaderContentNegotiationStrategy.java) y [MimeTypeUtils](https://github.com/spring-projects/spring-framework/blob/v6.1.3/spring-core/src/main/java/org/springframework/util/MimeTypeUtils.java): parsing y ordenación.
- [MimeType](https://github.com/spring-projects/spring-framework/blob/v6.1.3/spring-core/src/main/java/org/springframework/util/MimeType.java) y [MediaType](https://github.com/spring-projects/spring-framework/blob/v6.1.3/spring-web/src/main/java/org/springframework/http/MediaType.java): sufijos, compatibilidad y calidad.
- [HttpMediaTypeNotAcceptableException](https://github.com/spring-projects/spring-framework/blob/v6.1.3/spring-web/src/main/java/org/springframework/web/HttpMediaTypeNotAcceptableException.java) y [StringHttpMessageConverter](https://github.com/spring-projects/spring-framework/blob/v6.1.3/spring-web/src/main/java/org/springframework/http/converter/StringHttpMessageConverter.java): errores y texto.
