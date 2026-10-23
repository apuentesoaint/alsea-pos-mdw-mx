# Migración de Cuponera a AWS

Estado: requisitos acordados por el usuario; implementación local, aceptación operativa pendiente.

## Requisitos obligatorios

Node.js 24 para Lambdas y herramientas propias, AWS SDK v3 modular y ESM nativo con top-level await. Código propio sin CommonJS ni compilación TypeScript durante ejecución. Serverless Framework 3.40.0, serverless-esbuild 1.57.2 y esbuild 0.28.2; TypeScript ES2025/NodeNext. No cambiar runtime, SDK ni módulos para resolver incompatibilidades.

Replicar el código Java Cuponera preservando contratos, endpoints, reglas, integraciones y anomalías observables. No descargar JDK ni ejecutar Java. Mantener los siete endpoints de negocio/técnicos, Swagger y las rutas realmente presentes en las dependencias, sin inventar Actuator a partir del YAML. Consultar la [matriz estática](../../docs/compatibility.md).

API Gateway REST Regional, Lambdas bajo demanda por operación, DynamoDB operativo, S3 para detalle mayor de 300 KiB, un secreto externo por entorno administrado por DevOps y CloudWatch (ver [ADR 0007](../decisions/0007-single-devops-security-secret.md)). Entornos dev/qa/prod en us-east-1. Las hipótesis de carga y criterios operativos están en [operación](../../docs/operations.md).

## Aceptación

Los controles locales deben probar runtime 24, empaquetado ESM, top-level await y SDK modular sin compiladores de ejecución. La entrega productiva requiere además cero diferencias contractuales pendientes en escenarios aprobados, secretos fuera de código/paquetes/logs, reconciliación de migración y canjes inciertos, operación y recuperación probadas en qa y despliegue reproducible. Registrar por separado lo ejecutado y lo pendiente; ver [verificación](../../docs/verification.md).

El plan adicional de saneamiento y HTTP fue autorizado para ejecución, incluyendo adaptadores propios ESM cuando las actualizaciones transitivas no mantengan interfaz. La auditoría completa sin avisos y la resolución de variantes HTTP pendientes siguen siendo criterios de aceptación; las mitigaciones o hashes de artefactos no los sustituyen. Consultar [dependencias](../../docs/dependency-remediation.md) y [HTTP](../../docs/http-parity.md).
