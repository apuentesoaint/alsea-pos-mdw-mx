# Verificación y límites de entrega

## Método

La implementación se deriva de lectura estática del Java. Por instrucción expresa no se descargó JDK 21 ni se ejecutó el servicio o sus pruebas Java. Los hashes de la referencia están en [source-baseline.json](source-baseline.json). No se ejecutaron despliegues, importaciones reales, cambios DNS ni solicitudes a proveedores reales.

## Controles locales reproducibles

```sh
npm ci --ignore-scripts
npm run verify
npm run audit:dependencies
```

`verify` ejecuta comprobación estricta de tipos, pruebas de contratos y negocio, adaptadores con clientes simulados, empaquetado Serverless y carga real de los seis ZIP en Node.js 24. Los tests cubren JWT, descuentos, particularidades del origen, HTTP, timeouts sin reenvíos, escritura transaccional, lectura consistente, concurrencia, detalle S3, caché de secretos y conversión SQL.

También ejecuta los ZIP con el SDK v3 real sobre un servidor local, con salida externa bloqueada: JWT, validación, detalle grande S3, consulta, canje, generación y Swagger. No usa credenciales reales ni reproduce IAM o el motor de persistencia AWS.

El inspector comprueba `nodejs24.x` en CloudFormation, carga exports ESM con inicialización top-level await, exclusión de SDK v2 y compiladores TypeScript de los artefactos, retención y configuración de almacenamiento. La dependencia YAML se resuelve a su distribución ESM al empaquetar, evitando llamadas dinámicas a `require`.

Resultado de la revisión inicial del 2026-10-22: 75 pruebas aprobadas, incluida una matriz de 84 combinaciones de promociones/países/marcas. Instalación limpia del lockfile, tipos, empaquetado dev/qa/prod y ejecución local de los seis artefactos por entorno aprobados. La auditoría `npm audit --omit=dev` no reportó vulnerabilidades conocidas en dependencias de producción. La auditoría completa sí reportó 23 dependencias de desarrollo afectadas: 4 críticas, 10 altas y 9 moderadas. Ver [hallazgos, correcciones y riesgos](review.md); no equivale a una aprobación productiva.

Ejecución posterior del plan de saneamiento/HTTP: instalación limpia, comprobación de tipos y 118 pruebas aprobadas, con negociación Accept, precedencia de autenticación, efectos anteriores al 406, consumidores reales de herramientas, extracción local y manifiesto de integridad. Empaquetado dev/qa/prod, carga y ejecución local de los seis ZIP por entorno con SDK v3 y comprobación SHA-256 aprobados; no son despliegues. Los 84 hashes del Java permanecen iguales. La auditoría de aquella ejecución reportaba 15 paquetes afectados (0 críticos, 9 altos, 5 moderados y 1 bajo), producción 0. El comando de auditoría falla deliberadamente por esos avisos; no es una comprobación de seguridad aprobada. Ver [dependencias](dependency-remediation.md) y [HTTP](http-parity.md).

No se dispone de `cfn-lint` ni `cfn-guard` en este entorno. Las aserciones locales de la plantilla no sustituyen la validación de CloudFormation ni una evaluación exhaustiva de IAM. Los resultados concretos de cada ejecución se muestran en consola; no versionar paquetes, logs ni informes privados.

El auditor genérico de la skill también se ejecutó en modo estricto y reporta dos acciones: busca CodeBuild aunque este repositorio usa GitHub Actions, y clasifica como código propio archivos de skills, cachés y bundles de terceros. No se presenta ese auditor como aprobado. El control específico del proyecto sí inspecciona src/scripts/plugins/infra/test, exige ESM sin sintaxis CommonJS propia y comprueba la carga real de los ZIP. Los paquetes de herramientas de terceros no se convierten por ello en código Lambda.

## Aceptación aún pendiente

- Configurar URLs, cuenta, dominio, certificados y versiones de secretos con sus propietarios. Validar el esquema y la clave de firma del secreto único antes de habilitar tráfico.
- Desplegar dev/qa con credenciales temporales; verificar IAM, KMS, API Gateway, logs, métricas, alarmas y restauración real.
- Comparar respuestas con un entorno Java existente o fixtures aprobados por su propietario, sin ejecutar Java localmente. Resolver los límites registrados en [compatibility.md](compatibility.md), incluidos mensajes generados por Spring, OpenAPI y empates de fecha SQL.
- Validar integraciones reales, JWT cruzados, fallos, carga de negocio, tamaños, latencias y costos. Las cifras del plan son hipótesis, no resultados medidos.
- Obtener exportación SQL, confirmar zona horaria/intercalación, importar con escrituras detenidas y conciliar antes del corte. No se han migrado datos.
- Definir canal de avisos y procedimiento de resolución de canjes inciertos; probar ambos en qa.

La existencia de código y pruebas locales no certifica todavía cero diferencias contractuales, disponibilidad productiva ni finalización del corte.

## Revisión del secreto único (2026-10-23)

Ver la [revisión detallada](single-secret-review.md) para la evidencia vigente: 146 pruebas, tipos/ESLint, tres entornos empaquetados y validados con seis ZIP y simulación local, casos negativos y correcciones. La auditoría renovada completa mantiene el bloqueo por dos avisos bajos, producción cero; no se cambió el árbol de dependencias. Los resultados de las secciones anteriores son históricos y no sustituyen los límites de aceptación AWS de esta revisión.
