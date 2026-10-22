# 0003 — Secretos en ejecución y errores observables

Fecha: 2026-10-22. Estado: aceptada en el plan solicitado por el usuario.

## Contexto y decisión

El origen contiene credenciales y claves que no deben copiarse. CloudFormation crea secretos vacíos separados por propósito/entorno y una clave KMS. Las variables Lambda reciben ARN; SDK v3 recupera las versiones en ejecución con caché de 300 segundos. Roles por función y ausencia de VPC responden a las integraciones HTTP y AWS identificadas.

## Alternativas y motivos

Inyectar valores al desplegar expondría secretos en variables y plantillas; consultarlos en cada solicitud aumentaría latencia y costo. Roles temporales evitan copiar claves AWS del POM. No se añade NAT/VPC sin necesidad privada confirmada. Una frontera de errores compartida mantiene mensajes contractuales mientras los logs JSON usan campos permitidos y stacks saneados.

Solo Lambda Errors ocultaría errores técnicos devueltos como HTTP 400; EMF registra categorías propias, duración e incertidumbre. No registrar cuerpos ni excepciones completas reduce filtraciones. Los errores de negocio se separan de fallos técnicos para no disparar alertas por rechazos normales.

## Consecuencias

El propietario debe cargar versiones antes de tráfico y coordinar rotación con proveedores/JWT; caché implica propagación acotada. Los secretos no forman parte de esta entrega. CloudWatch ofrece dashboard y alarmas; el canal real de notificación y sus pruebas quedan pendientes de definición operativa. Regresar de AWS a Java después de escrituras exige conciliación inversa, no solo cambiar código.
