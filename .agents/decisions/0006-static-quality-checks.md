# 0006 — Análisis estático gradual y validación de CloudFormation

Fecha: 2026-10-23. Estado: aceptada por instrucción del usuario de aplicar la recomendación.

## Contexto y decisión

Añadir ESLint como dependencia de desarrollo con flat config ESM y reglas orientadas a errores, integrado en verify y CI. El alcance inicial es JavaScript propio; mantener TypeScript 7.0.2 bajo tsc estricto, porque typescript-eslint 8.72.0 declara soporte menor a 6.1.0. No forzar una combinación incompatible ni degradar TypeScript.

Validar la plantilla compilada por Serverless con cfn-lint 1.58.0 en un venv local. La preparación es explícita y CI la reproduce con Python 3.14. Los errores bloquean; las advertencias se registran completas sin suprimir reglas. Esto complementa las pruebas y controles de artefactos existentes, sin sustituir la auditoría npm.

## Alternativas y motivos

Incorporar un parser TypeScript no soportado produciría una garantía de cobertura que no podemos sostener. Limitarse a tsc dejaría sin análisis los plugins y scripts JavaScript. Validar fragmentos YAML sin componer produciría referencias incompletas. Instalar Python globalmente afectaría otras herramientas del usuario.

## Consecuencias

Verify requiere preparar primero el venv. TypeScript carece temporalmente de lint y hay advertencias CloudFormation visibles de la generación Serverless. El hallazgo E1156 se corrige con GatewayLogsRoleArn como parámetro validado y transmitido explícitamente en las actualizaciones. No se despliega ni se flexibiliza la aceptación de seguridad. Detalles y límites en [calidad](../../docs/code-quality.md).

## Revisión detallada del 2026-10-23

Aplicar los controles también al despliegue protegido. Invalidar informes anteriores antes de validar, limitar tiempos y verificar la respuesta del ejecutable. Cubrir con ESLint todo el JavaScript propio, manteniendo las exclusiones de terceros y artefactos. Probar modos de fallo, dummies, rotación de secretos y bloqueo de publicación con SDK/subprocesos simulados. Retirar las doce sustituciones CloudFormation innecesarias de alarmas sin cambiar nombres o métricas.

La segunda revisión conserva la URL pública de documentación de desarrollo por HTTP exclusivamente en loopback. No se flexibiliza HTTPS de las integraciones. Los payloads de secretos rechazan puertos SQL inválidos y prefijos Basic duplicados antes del SDK; los números de puerto en cadena siguen siendo compatibles con el consumidor existente.
