# 0005 — Infraestructura modular en YAML

Fecha: 2026-10-23. Estado: aceptada por solicitud explícita del usuario.

## Contexto

La infraestructura propia se generaba en `infra/resources.js`, mientras las funciones y variables se declaraban en `serverless.yml`. El usuario pidió concentrar la infraestructura en archivos `.yml` referenciados desde el principal, con la configuración visible allí. Después de revisar el origen, indicó usar valores dummy cuando no existiera configuración real.

## Decisión

Separar funciones, compilación, metadatos del stack, almacenamiento, secretos, IAM, gateway y observabilidad en YAML. `serverless.yml` orquesta las inclusiones y centraliza variables, parámetros públicos por entorno y estructuras dummy de los secretos. El plugin conserva únicamente la dependencia sobre el Deployment generado por Serverless. Se mantiene un stack por entorno.

Conservar los recursos y sus identificadores del estado de trabajo recibido, incluido TransactionsPOS. Mantener el ADR 0003: las estructuras dummy no crean versiones ni se inyectan como credenciales. Las URLs stage del origen quedan restringidas a dev y documentadas según sean activas o comentadas; los valores desconocidos usan REPLACE_ME/.invalid.

## Alternativas y motivos

Mantener el generador JavaScript no cumple el formato solicitado. Copiar sus recursos sin conservar identificadores podría reemplazar recursos con datos. Stacks anidados añadirían una migración de propiedad innecesaria. SecretString con credenciales reales expondría los valores en plantillas; versiones con dummies ocultarían una carga operativa incompleta.

## Consecuencias

La revisión de infraestructura se realiza directamente sobre YAML, con cierta repetición explícita en roles y alarmas. Las fechas IAM deben ir entre comillas. Los parámetros pueden sobrescribirse con configuración pública mediante el flujo protegido existente; el despliegue sigue requiriendo cuenta, URLs reales, secretos cargados y controles de seguridad. Los marcadores no constituyen valores verificados de integración.

Análisis y trazabilidad: [infraestructura](../../docs/serverless-infrastructure.md).

## Ajuste tras revisión detallada del 2026-10-23

Los ejemplos comentados no acreditan valores activos: token, validate y redeem usan dummy también en dev. Solo generación conserva su URL activa de referencia. Las plantillas de secretos contienen exactamente los cinco payloads y comentarios YAML, sin campos auxiliares accidentales. La carga y el despliegue rechazan REPLACE_ME.

### Compatibilidad de la creación inicial de Serverless 3.40.0

Tras el fallo de despliegue reportado por el usuario, se amplía la responsabilidad del plugin local: filtrar `provider.stackParameters` durante `createStack` según los parámetros declarados en la plantilla provisional y restaurarlos antes de aplicar la plantilla completa. El código instalado reutiliza la misma lista para ambas plantillas, pero la provisional no declara los parámetros propios. Retirarlos definitivamente perdería overrides en actualizaciones; introducir recursos declarativos en el plugin contradiría esta decisión. Se mantienen los YAML y la versión del framework. La regresión usa los métodos reales del framework con AWS simulado; reintento real pendiente. Ver [infraestructura](../../docs/serverless-infrastructure.md#creación-inicial-y-parámetros-del-stack).
