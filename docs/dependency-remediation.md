# Saneamiento de dependencias

Fecha: 2026-10-22. Estado: correcciones parciales verificadas; aceptación de seguridad bloqueada.

## Resultado vigente de la revisión del secreto único (2026-10-23)

`npm run audit:dependencies` se volvió a ejecutar: **2 paquetes afectados, ambos bajos**, y **0 avisos de producción**. El informe completo identifica aws-sdk transitivo de herramientas y su metavulnerabilidad en Serverless, asociados a [GHSA-j965-2qgj-vjmq](https://github.com/advisories/GHSA-j965-2qgj-vjmq). npm propone Serverless 4.45.0 como cambio mayor; el requisito del proyecto conserva 3.40.0. No se actualizan dependencias, lockfile ni excepciones en esta revisión. El comando sigue fallando y el despliegue permanece bloqueado por el gate de cero avisos.

Los conteos 23/15/10 siguientes son históricos. No se atribuye la reducción del informe actual a una corrección del secreto único: esta revisión no cambió el árbol de dependencias ni determina la causa de diferencias en los avisos publicados. Ver [revisión detallada](single-secret-review.md).

## Línea base y resultado histórico

La auditoría inicial tenía 23 paquetes afectados: 4 críticos, 10 altos y 9 moderados. Tras las sustituciones, el informe completo registra 15: 0 críticos, 9 altos, 5 moderados y 1 bajo. Producción conserva cero avisos conocidos. Son conteos de paquetes afectados y metavulnerabilidades, no de CVE independientes.

`npm run audit:dependencies` obtiene informes nuevos completos y de producción en `.cache/security/`, y falla si cualquiera registra avisos. Un fallo de red o un informe inválido también bloquean. Los conteos no son una garantía permanente frente a nuevos avisos.

## Auditoría posterior del 2026-10-23

Al incorporar ESLint se repitió `npm run audit:dependencies`: el árbol completo registra 10 paquetes afectados (9 altos, 1 bajo), producción cero. La auditoría continúa fallando deliberadamente. La causa sprintf-js ya no figura en el informe actual; su ausencia no se atribuye a una corrección de este cambio ni sustituye los resultados históricos de abajo. Ver [calidad](code-quality.md).

## Cambios aplicados

| Dependencia | Resolución fijada | Adaptación y evidencia |
| --- | --- | --- |
| simple-git | 4.0.2 | Su consumidor usa la función nombrada `simpleGit`; la carga directa anterior no era compatible. Prueba de carga del consumidor real. |
| tar | 7.5.22 | Se conserva la API utilizada. Creación y extracción TGZ local, además del empaquetado. |
| adm-zip | 0.6.1 | Conserva API de constructor. Creación y extracción ZIP local. |
| decompress | Alias npm a @xhmikosr/decompress 11.1.4 | Los consumidores download e invoke-local acceden al export default. Pruebas de download real con ZIP/TGZ y de contención de rutas/enlaces. No se certifica invoke-local completo ni sus runtimes ajenos al proyecto. |
| file-type 16 y 20/21 | 21.3.4 | download utiliza `fileTypeFromBuffer`. La instancia antigua 4.x de archive-type conserva su interfaz síncrona; no se reemplaza indiscriminadamente. |
| uuid | 11.1.1 | Los consumidores conservan exports nombrados v1/v4. Empaquetado y carga de CLI verifican la integración utilizada. |

Los overrides y el lockfile hacen reproducibles las sustituciones. No se modifica node_modules en disco. El preload ESM `scripts/toolchain-compat.mjs` adapta tres archivos consumidores de terceros al cargarlos: restringe ruta, SHA-256 y coincidencia única; falla cerrado ante cambios. No contiene código CommonJS propio, ni se incorpora al ZIP Lambda. No es un mecanismo general de transformación de código.

Usar `npm run package`, `npm run serverless -- <comando>` y el script de despliegue documentado. Invocar directamente el binario sin preload omite la adaptación y no constituye un flujo soportado.

## Tres causas del informe histórico

| Causa | Dependencias afectadas y evidencia | Motivo de no declararla corregida |
| --- | --- | --- |
| braces 3.0.3 | braces, micromatch, fast-glob, globby, chokidar, Serverless y plugins. [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). | La versión publicada continúa dentro del rango vulnerable. Sustituir expansión de llaves implica compatibilidad de patrones y salidas; no se ha validado una sustitución equivalente. |
| sprintf-js 1.1.3 | argparse 1.x, js-yaml 3.x, yamljs, json-refs y paquetes padres. [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c). | No existe corrección publicada en esa línea. Cambiar argparse/js-yaml de versión principal altera APIs utilizadas por terceros y exige otra adaptación con pruebas. |
| Dependencia aws-sdk de herramientas de terceros | [GHSA-j965-2qgj-vjmq](https://github.com/advisories/GHSA-j965-2qgj-vjmq). | El aviso no se resuelve actualizando esa dependencia dentro de su línea. No se permite introducir SDK v2 en código propio ni sustituir SDK v3. No se implementa una fachada parcial que simule la extensa API del SDK y pueda fallar al desplegar. |

En aquel informe los tres avisos raíz se propagaban a 15 paquetes; no describe la auditoría vigente. No hay allowlist, cambio de severidad, eliminación artificial de dependencias ni renombrado de código vulnerable para aprobar la auditoría. Las adaptaciones autorizadas permiten corregir interfaces conocidas, pero no demuestran equivalencia de implementaciones todavía inexistentes. El requisito de cero avisos sigue pendiente; el gate y el script de despliegue impiden tratar este estado como aprobable.

## Construcción e integridad

CI ejecuta verificación funcional y seguridad en trabajos independientes, sin roles AWS y sin persistir la credencial Git del checkout. Conserva los informes incluso al fallar. El trabajo funcional publica el paquete verificado; no configura un despliegue automático.

El despliegue prepara y verifica paquetes en procesos hijos sin variables de credenciales AWS y con archivos de configuración/credenciales apuntando al dispositivo nulo y metadatos EC2 desactivados. Los clientes SDK v3 del proceso padre realizan las comprobaciones de cuenta, y solo el comando de despliegue recibe su entorno de credenciales. Esta separación no sustituye un runner efímero y aislado.

Tras comprobar los ZIP y ejecutarlos contra la simulación local, se registra `artifact-integrity.json`: SHA-256 del lockfile y de los archivos del paquete. Antes de desplegar se exige auditoría completa sin avisos y coincidencia del manifiesto. El hash detecta cambios posteriores; no es firma de procedencia, ni demuestra por sí solo que el contenido sea seguro.

## Fuentes

- [Interoperabilidad y hooks de módulos en Node.js](https://nodejs.org/docs/latest-v24.x/api/module.html).
- [Aviso de simple-git/argv-parser](https://github.com/advisories/GHSA-v5rq-49vh-5v5c).
- [Corrección de cadenas de enlaces en decompress](https://github.com/advisories/GHSA-hrh2-vp3x-79xf).
- [Avisos y metavulnerabilidades npm](https://docs.npmjs.com/cli/v11/commands/npm-audit/).
