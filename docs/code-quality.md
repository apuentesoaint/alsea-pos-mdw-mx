# Análisis estático de código e infraestructura

Configuración incorporada el 2026-10-23. No se cambian Node.js 24, TypeScript 7.0.2, ESM, SDK v3 ni las versiones fijadas de Serverless/esbuild.

## JavaScript propio

`npm run lint` ejecuta ESLint 10.13.0 con `@eslint/js` 10.0.1 y `globals` 17.13.0, dependencias exclusivamente de desarrollo fijadas en npm. `eslint.config.mjs` usa flat config ESM, reglas recomendadas, igualdad estricta con la comparación intencionada contra null permitida, preferencia por const y prohibición de var. No se añaden reglas de formato ni arreglos masivos.

El alcance es todo el JavaScript propio (`**/*.{js,mjs}`), incluidos scripts, plugins, configuración ESM y futuros archivos fuera de esos directorios. Se excluyen dependencias, artefactos, activos de terceros y el catálogo de skills. Los errores y cualquier advertencia ESLint bloquean el comando (`--max-warnings=0`).

**Los archivos TypeScript no tienen cobertura ESLint.** `typescript-eslint` 8.72.0 declara `typescript >=4.8.4 <6.1.0` en el registro npm, incompatible con el TypeScript 7.0.2 del proyecto. No se instala con `--force` ni se desactiva su aviso. `npm run typecheck` continúa comprobando TypeScript con la configuración estricta existente; esto no equivale a disponer de las reglas de lint tipadas. La cobertura podrá ampliarse cuando exista soporte compatible comprobado.

## Plantilla CloudFormation

Se utiliza cfn-lint 1.58.0, fijado en `requirements-dev.txt`. Requiere Python >=3.10 y <3.15; CI usa Python 3.14. Se instala en un entorno aislado e ignorado por Git:

```sh
npm run setup:infra-lint
npm run package
npm run lint:infra
```

`setup:infra-lint` crea `.cache/cfn-lint` e instala desde PyPI con pip; no instala herramientas Python globales. El comando está escrito para las plataformas macOS/Linux del entorno actual y CI. Si se elimina `.cache`, se debe repetir la instalación. El wrapper reconoce también la ubicación Windows, pero la preparación documentada usa sintaxis POSIX.

`lint:infra` valida `.serverless/cloudformation-template-update-stack.json` con los esquemas de us-east-1. No valida aisladamente los fragmentos YAML, porque Serverless debe resolver variables, unir recursos y generar API Gateway/Lambda primero. Puede comprobar otro directorio de empaquetado:

```sh
npm run lint:infra -- .cache/infrastructure-qa
```

Los errores de esquema y los fallos de ejecución bloquean el comando. Las advertencias se muestran agrupadas y el informe JSON completo, con regla, ubicación y mensaje, se conserva en `.cache/quality/cfn-lint.json`; CI lo publica como artefacto. No se deshabilitan reglas. Cada ejecución elimina primero el informe anterior, incluso si falta el ejecutable o la plantilla. Se validan la versión y la estructura JSON de la respuesta, se rechazan fallos de proceso/señales y se limitan la consulta de versión a 10 segundos y la validación a 120 segundos.

En la revisión posterior se retiraron doce Fn::Sub innecesarios de las dimensiones de alarmas: sus nombres ya los resuelve Serverless. En dev quedan siete advertencias: seis W3005 por DependsOn redundantes que Serverless añade a los roles Lambda; una W8003 porque IsProduction compara el entorno ya resuelto. En qa/prod puede variar W8003 según la igualdad del entorno. Son avisos visibles, no errores de esquema ni resultados de una auditoría de seguridad.

La validación encontró E1156 en la rama de ARN vacío de ApiGatewayAccount. Ahora `GatewayLogsRoleArn` es un parámetro CloudFormation String, con patrón de ARN o vacío, y las condiciones y el recurso lo referencian. `provider.stackParameters` transmite el valor expresamente tanto al crear como al actualizar, evitando depender de un Default anterior. Vacío sigue creando el rol; un ARN existente sigue reutilizándolo. Se conservan condiciones, retención y recursos. La validación de esquemas no prueba IAM ni el comportamiento real en AWS.

## Verificación y CI

`npm run verify` ejecuta ESLint, tipos, pruebas, empaquetado dev, cfn-lint, inspección/carga de ZIP, simulación local e integridad SHA-256. La preparación de cfn-lint es explícita; verify no descarga herramientas. CI prepara Node.js 24 y Python 3.14, instala las dependencias y ejecuta el mismo comando.

El despliegue protegido también ejecuta ESLint y cfn-lint antes de inspeccionar artefactos o permitir la publicación. Las pruebas de ese flujo simulan el SDK y los subprocesos; comprueban orden, modo sin --execute y bloqueo ante fallos, sin contactar AWS. `npm test` limita a tres archivos de prueba concurrentes para acotar los subprocesos de las herramientas.

La auditoría de dependencias permanece separada y bloqueante en CI. La ejecución del 2026-10-23 registra 10 avisos en el árbol completo (9 altos, 1 bajo), y cero en producción; no se aprobaron excepciones ni se ejecutó `npm audit fix --force`. Ese resultado no cierra los bloqueos de aceptación documentados.

Comprobaciones locales: instalación limpia `npm ci --ignore-scripts`, `npm run verify` aprobado con 121 pruebas, ESLint sin errores ni advertencias y cfn-lint sin errores. Se comprobó además que ESLint rechaza una variable inexistente y que el comando de infraestructura falla ante un MemorySize inválido, usando entradas temporales fuera del código. `pip check` no encontró incompatibilidades en el venv. Se empaquetaron y validaron dev, qa, prod y la variante con rol regional existente: cero errores y 19 advertencias en cada caso.

No se instaló cfn-guard ni se certificó compliance. No se desplegó infraestructura ni se ejecutó Java. La ejecución local de CI no demuestra que GitHub Actions haya corrido en remoto.

## Fuentes

- [ESLint: instalación](https://eslint.org/docs/latest/use/getting-started) y [flat config](https://eslint.org/docs/latest/use/configure/configuration-files).
- [Compatibilidad de typescript-eslint](https://typescript-eslint.io/users/dependency-versions/); corroborada con peerDependencies de npm para 8.72.0.
- [cfn-lint oficial](https://github.com/aws-cloudformation/cfn-lint) y [validación en AWS CloudFormation](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cfn-lint.html).

## Revisión posterior

La [revisión detallada](serverless-quality-review.md) registra las correcciones y la ejecución posterior con 127 pruebas. El estado actual es cero errores de cfn-lint y siete advertencias; los resultados con 121 pruebas y 19 advertencias descritos arriba son la evidencia anterior.

La segunda revisión añadió validación de puerto SQL y prefijo Basic, y corrigió la excepción HTTP de documentación de desarrollo en loopback. La ejecución posterior aprueba 129 pruebas; ver la última sección de la [revisión](serverless-quality-review.md).
