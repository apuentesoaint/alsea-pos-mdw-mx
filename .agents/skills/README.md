# Skills instaladas

El repositorio contiene **149 skills principales** en directorios locales, registradas en [skills-lock.json](../../skills-lock.json). Este catálogo ofrece una ruta de lectura independiente del proveedor del agente. Los nombres originales permiten localizar cada procedimiento; su `description` y sus instrucciones completas están en el `SKILL.md` enlazado.

## Cómo seleccionar y utilizar una skill

1. Identifica la tarea en el catálogo y lee la cabecera `description` de las candidatas.
2. Abre el `SKILL.md` pertinente y sigue sus pasos dentro de las instrucciones compartidas de [AGENTS.md](../../AGENTS.md) y del alcance autorizado por el usuario.
3. Resuelve los recursos relativos desde el directorio de esa skill; carga únicamente los necesarios. Si una skill menciona otra por nombre, búscala en este catálogo.
4. Si el agente no tiene soporte nativo para skills, lee estos archivos manualmente. No hace falta copiarlos ni instalarlos en carpetas de cada proveedor.
5. Comprueba los requisitos del procedimiento: CLI, MCP, credenciales, permisos y acceso de red. Si falta alguno, informa de la limitación; disponer del archivo no demuestra que una operación pueda ejecutarse.

Para tareas serverless con selección de arquitectura pendiente, empieza por [aws-serverless](aws-serverless/SKILL.md). Para bases de datos y redes, consulta [aws-database](aws-database/SKILL.md) y [aws-networking](aws-networking/SKILL.md). Si la tarea ya identifica un procedimiento concreto, consulta su skill específica.

Las skills proceden de `aws/agent-toolkit-for-aws`, según el lock. Se conserva su contenido original, que puede estar en inglés; la documentación compartida de este repositorio se mantiene en español. Su instalación no confirma que se utilicen esos servicios en el proyecto.

## Catálogo completo

### Entrada general de AWS (1)

Autenticación y acceso inicial a AWS.

| Skill y procedimiento | Cuándo consultarla |
| --- | --- |
| [aws-secrets-manager](aws-secrets-manager/SKILL.md) | Cuando la tarea involucre `aws-secrets-manager`; confirma el alcance en su `description`. |

### Servicios y áreas de AWS (24)

Seleccionar y trabajar con el servicio o área AWS indicado por el nombre de la skill.

| Skill y procedimiento | Cuándo consultarla |
| --- | --- |
| [amazon-bedrock](amazon-bedrock/SKILL.md) | Cuando la tarea involucre `amazon-bedrock`; confirma el alcance en su `description`. |
| [aws-ai-ml](aws-ai-ml/SKILL.md) | Cuando la tarea involucre `aws-ai-ml`; confirma el alcance en su `description`. |
| [aws-auth](aws-auth/SKILL.md) | Cuando la tarea involucre `aws-auth`; confirma el alcance en su `description`. |
| [aws-billing-and-cost-management](aws-billing-and-cost-management/SKILL.md) | Cuando la tarea involucre `aws-billing-and-cost-management`; confirma el alcance en su `description`. |
| [aws-blocks](aws-blocks/SKILL.md) | Cuando la tarea involucre `aws-blocks`; confirma el alcance en su `description`. |
| [aws-cdk](aws-cdk/SKILL.md) | Cuando la tarea involucre `aws-cdk`; confirma el alcance en su `description`. |
| [aws-cloudformation](aws-cloudformation/SKILL.md) | Cuando la tarea involucre `aws-cloudformation`; confirma el alcance en su `description`. |
| [aws-compute](aws-compute/SKILL.md) | Cuando la tarea involucre `aws-compute`; confirma el alcance en su `description`. |
| [aws-containers](aws-containers/SKILL.md) | Cuando la tarea involucre `aws-containers`; confirma el alcance en su `description`. |
| [aws-database](aws-database/SKILL.md) | Cuando la tarea involucre `aws-database`; confirma el alcance en su `description`. |
| [aws-deployment](aws-deployment/SKILL.md) | Cuando la tarea involucre `aws-deployment`; confirma el alcance en su `description`. |
| [aws-iam](aws-iam/SKILL.md) | Cuando la tarea involucre `aws-iam`; confirma el alcance en su `description`. |
| [aws-messaging-and-streaming](aws-messaging-and-streaming/SKILL.md) | Cuando la tarea involucre `aws-messaging-and-streaming`; confirma el alcance en su `description`. |
| [aws-networking](aws-networking/SKILL.md) | Cuando la tarea involucre `aws-networking`; confirma el alcance en su `description`. |
| [aws-observability](aws-observability/SKILL.md) | Cuando la tarea involucre `aws-observability`; confirma el alcance en su `description`. |
| [aws-sdk-js-v3-usage](aws-sdk-js-v3-usage/SKILL.md) | Cuando la tarea involucre `aws-sdk-js-v3-usage`; confirma el alcance en su `description`. |
| [aws-sdk-python-usage](aws-sdk-python-usage/SKILL.md) | Cuando la tarea involucre `aws-sdk-python-usage`; confirma el alcance en su `description`. |
| [aws-sdk-swift-usage](aws-sdk-swift-usage/SKILL.md) | Cuando la tarea involucre `aws-sdk-swift-usage`; confirma el alcance en su `description`. |
| [aws-security](aws-security/SKILL.md) | Cuando la tarea involucre `aws-security`; confirma el alcance en su `description`. |
| [aws-serverless](aws-serverless/SKILL.md) | Cuando la tarea involucre `aws-serverless`; confirma el alcance en su `description`. |
| [aws-storage](aws-storage/SKILL.md) | Cuando la tarea involucre `aws-storage`; confirma el alcance en su `description`. |
| [aws-well-architected-review](aws-well-architected-review/SKILL.md) | Cuando la tarea involucre `aws-well-architected-review`; confirma el alcance en su `description`. |
| [launch-with-aws](launch-with-aws/SKILL.md) | Cuando la tarea involucre `launch-with-aws`; confirma el alcance en su `description`. |
| [signing-in-to-aws](signing-in-to-aws/SKILL.md) | Cuando la tarea involucre `signing-in-to-aws`; confirma el alcance en su `description`. |

### Procedimientos especializados (91)

Ejecutar la tarea o trabajar con el servicio indicado por el nombre de la skill.

| Skill y procedimiento | Cuándo consultarla |
| --- | --- |
| [amazon-aurora-mysql](amazon-aurora-mysql/SKILL.md) | Cuando la tarea involucre `amazon-aurora-mysql`; confirma el alcance en su `description`. |
| [amazon-aurora-postgresql](amazon-aurora-postgresql/SKILL.md) | Cuando la tarea involucre `amazon-aurora-postgresql`; confirma el alcance en su `description`. |
| [amazon-braket](amazon-braket/SKILL.md) | Cuando la tarea involucre `amazon-braket`; confirma el alcance en su `description`. |
| [amazon-documentdb](amazon-documentdb/SKILL.md) | Cuando la tarea involucre `amazon-documentdb`; confirma el alcance en su `description`. |
| [amazon-dynamodb](amazon-dynamodb/SKILL.md) | Cuando la tarea involucre `amazon-dynamodb`; confirma el alcance en su `description`. |
| [amazon-ec2-image-builder](amazon-ec2-image-builder/SKILL.md) | Cuando la tarea involucre `amazon-ec2-image-builder`; confirma el alcance en su `description`. |
| [amazon-elasticache](amazon-elasticache/SKILL.md) | Cuando la tarea involucre `amazon-elasticache`; confirma el alcance en su `description`. |
| [amazon-eventbridge-event-bus](amazon-eventbridge-event-bus/SKILL.md) | Cuando la tarea involucre `amazon-eventbridge-event-bus`; confirma el alcance en su `description`. |
| [amazon-keyspaces](amazon-keyspaces/SKILL.md) | Cuando la tarea involucre `amazon-keyspaces`; confirma el alcance en su `description`. |
| [amazon-neptune](amazon-neptune/SKILL.md) | Cuando la tarea involucre `amazon-neptune`; confirma el alcance en su `description`. |
| [amazon-opensearch-service](amazon-opensearch-service/SKILL.md) | Cuando la tarea involucre `amazon-opensearch-service`; confirma el alcance en su `description`. |
| [amazon-ses](amazon-ses/SKILL.md) | Cuando la tarea involucre `amazon-ses`; confirma el alcance en su `description`. |
| [amazon-workspaces-agent-access](amazon-workspaces-agent-access/SKILL.md) | Cuando la tarea involucre `amazon-workspaces-agent-access`; confirma el alcance en su `description`. |
| [arc-region-switch](arc-region-switch/SKILL.md) | Cuando la tarea involucre `arc-region-switch`; confirma el alcance en su `description`. |
| [aurora-dsql](aurora-dsql/SKILL.md) | Cuando la tarea involucre `aurora-dsql`; confirma el alcance en su `description`. |
| [authoring-mwaa-workflow](authoring-mwaa-workflow/SKILL.md) | Cuando la tarea involucre `authoring-mwaa-workflow`; confirma el alcance en su `description`. |
| [aws-amplify](aws-amplify/SKILL.md) | Cuando la tarea involucre `aws-amplify`; confirma el alcance en su `description`. |
| [aws-cleanrooms](aws-cleanrooms/SKILL.md) | Cuando la tarea involucre `aws-cleanrooms`; confirma el alcance en su `description`. |
| [aws-fault-injection-service](aws-fault-injection-service/SKILL.md) | Cuando la tarea involucre `aws-fault-injection-service`; confirma el alcance en su `description`. |
| [aws-lambda-durable-functions](aws-lambda-durable-functions/SKILL.md) | Cuando la tarea involucre `aws-lambda-durable-functions`; confirma el alcance en su `description`. |
| [aws-lambda-managed-instances](aws-lambda-managed-instances/SKILL.md) | Cuando la tarea involucre `aws-lambda-managed-instances`; confirma el alcance en su `description`. |
| [aws-lambda-microvms](aws-lambda-microvms/SKILL.md) | Cuando la tarea involucre `aws-lambda-microvms`; confirma el alcance en su `description`. |
| [aws-lambda-web-functions](aws-lambda-web-functions/SKILL.md) | Cuando la tarea involucre `aws-lambda-web-functions`; confirma el alcance en su `description`. |
| [aws-marketplace-metering](aws-marketplace-metering/SKILL.md) | Cuando la tarea involucre `aws-marketplace-metering`; confirma el alcance en su `description`. |
| [aws-network-monitoring](aws-network-monitoring/SKILL.md) | Cuando la tarea involucre `aws-network-monitoring`; confirma el alcance en su `description`. |
| [aws-resilience-lifecycle](aws-resilience-lifecycle/SKILL.md) | Cuando la tarea involucre `aws-resilience-lifecycle`; confirma el alcance en su `description`. |
| [aws-sms-voice](aws-sms-voice/SKILL.md) | Cuando la tarea involucre `aws-sms-voice`; confirma el alcance en su `description`. |
| [aws-social-messaging](aws-social-messaging/SKILL.md) | Cuando la tarea involucre `aws-social-messaging`; confirma el alcance en su `description`. |
| [aws-step-functions](aws-step-functions/SKILL.md) | Cuando la tarea involucre `aws-step-functions`; confirma el alcance en su `description`. |
| [aws-transform](aws-transform/SKILL.md) | Cuando la tarea involucre `aws-transform`; confirma el alcance en su `description`. |
| [cloudfront](cloudfront/SKILL.md) | Cuando la tarea involucre `cloudfront`; confirma el alcance en su `description`. |
| [configuring-vpc-endpoints-for-private-aws-service-access](configuring-vpc-endpoints-for-private-aws-service-access/SKILL.md) | Cuando la tarea involucre `configuring-vpc-endpoints-for-private-aws-service-access`; confirma el alcance en su `description`. |
| [connecting-lambda-to-api-gateway](connecting-lambda-to-api-gateway/SKILL.md) | Cuando la tarea involucre `connecting-lambda-to-api-gateway`; confirma el alcance en su `description`. |
| [connecting-lambda-to-dynamodb](connecting-lambda-to-dynamodb/SKILL.md) | Cuando la tarea involucre `connecting-lambda-to-dynamodb`; confirma el alcance en su `description`. |
| [connecting-to-data-source](connecting-to-data-source/SKILL.md) | Cuando la tarea involucre `connecting-to-data-source`; confirma el alcance en su `description`. |
| [connecting-vpcs-with-peering](connecting-vpcs-with-peering/SKILL.md) | Cuando la tarea involucre `connecting-vpcs-with-peering`; confirma el alcance en su `description`. |
| [creating-amazon-aurora-db-cluster-with-instances](creating-amazon-aurora-db-cluster-with-instances/SKILL.md) | Cuando la tarea involucre `creating-amazon-aurora-db-cluster-with-instances`; confirma el alcance en su `description`. |
| [creating-api-gateway-stage](creating-api-gateway-stage/SKILL.md) | Cuando la tarea involucre `creating-api-gateway-stage`; confirma el alcance en su `description`. |
| [creating-data-lake-table](creating-data-lake-table/SKILL.md) | Cuando la tarea involucre `creating-data-lake-table`; confirma el alcance en su `description`. |
| [creating-production-vpc-multi-az](creating-production-vpc-multi-az/SKILL.md) | Cuando la tarea involucre `creating-production-vpc-multi-az`; confirma el alcance en su `description`. |
| [creating-secrets-using-best-practices](creating-secrets-using-best-practices/SKILL.md) | Cuando la tarea involucre `creating-secrets-using-best-practices`; confirma el alcance en su `description`. |
| [debugging-lambda-timeouts](debugging-lambda-timeouts/SKILL.md) | Cuando la tarea involucre `debugging-lambda-timeouts`; confirma el alcance en su `description`. |
| [debugging-mwaa-workflow](debugging-mwaa-workflow/SKILL.md) | Cuando la tarea involucre `debugging-mwaa-workflow`; confirma el alcance en su `description`. |
| [deploying-custom-domain-rest-api](deploying-custom-domain-rest-api/SKILL.md) | Cuando la tarea involucre `deploying-custom-domain-rest-api`; confirma el alcance en su `description`. |
| [developing-applications-on-managed-service-for-apache-flink](developing-applications-on-managed-service-for-apache-flink/SKILL.md) | Cuando la tarea involucre `developing-applications-on-managed-service-for-apache-flink`; confirma el alcance en su `description`. |
| [directconnect](directconnect/SKILL.md) | Cuando la tarea involucre `directconnect`; confirma el alcance en su `description`. |
| [dms-schema-conversion](dms-schema-conversion/SKILL.md) | Cuando la tarea involucre `dms-schema-conversion`; confirma el alcance en su `description`. |
| [enabling-lambda-vpc-internet-access](enabling-lambda-vpc-internet-access/SKILL.md) | Cuando la tarea involucre `enabling-lambda-vpc-internet-access`; confirma el alcance en su `description`. |
| [exploring-data-catalog](exploring-data-catalog/SKILL.md) | Cuando la tarea involucre `exploring-data-catalog`; confirma el alcance en su `description`. |
| [exporting-rds-to-s3](exporting-rds-to-s3/SKILL.md) | Cuando la tarea involucre `exporting-rds-to-s3`; confirma el alcance en su `description`. |
| [finding-data-lake-assets](finding-data-lake-assets/SKILL.md) | Cuando la tarea involucre `finding-data-lake-assets`; confirma el alcance en su `description`. |
| [ingesting-into-data-lake](ingesting-into-data-lake/SKILL.md) | Cuando la tarea involucre `ingesting-into-data-lake`; confirma el alcance en su `description`. |
| [launching-ec2-instance-with-best-practices](launching-ec2-instance-with-best-practices/SKILL.md) | Cuando la tarea involucre `launching-ec2-instance-with-best-practices`; confirma el alcance en su `description`. |
| [managing-amazon-kinesis-data-streams](managing-amazon-kinesis-data-streams/SKILL.md) | Cuando la tarea involucre `managing-amazon-kinesis-data-streams`; confirma el alcance en su `description`. |
| [managing-amazon-msk](managing-amazon-msk/SKILL.md) | Cuando la tarea involucre `managing-amazon-msk`; confirma el alcance en su `description`. |
| [migrate-to-msk](migrate-to-msk/SKILL.md) | Cuando la tarea involucre `migrate-to-msk`; confirma el alcance en su `description`. |
| [migrating-to-amazon-redshift](migrating-to-amazon-redshift/SKILL.md) | Cuando la tarea involucre `migrating-to-amazon-redshift`; confirma el alcance en su `description`. |
| [processing-s3-uploads-with-step-functions](processing-s3-uploads-with-step-functions/SKILL.md) | Cuando la tarea involucre `processing-s3-uploads-with-step-functions`; confirma el alcance en su `description`. |
| [querying-aws-cloudwatch](querying-aws-cloudwatch/SKILL.md) | Cuando la tarea involucre `querying-aws-cloudwatch`; confirma el alcance en su `description`. |
| [querying-aws-redshift](querying-aws-redshift/SKILL.md) | Cuando la tarea involucre `querying-aws-redshift`; confirma el alcance en su `description`. |
| [querying-aws-s3](querying-aws-s3/SKILL.md) | Cuando la tarea involucre `querying-aws-s3`; confirma el alcance en su `description`. |
| [querying-aws-sagemaker-catalog](querying-aws-sagemaker-catalog/SKILL.md) | Cuando la tarea involucre `querying-aws-sagemaker-catalog`; confirma el alcance en su `description`. |
| [querying-data-lake](querying-data-lake/SKILL.md) | Cuando la tarea involucre `querying-data-lake`; confirma el alcance en su `description`. |
| [rds-db2](rds-db2/SKILL.md) | Cuando la tarea involucre `rds-db2`; confirma el alcance en su `description`. |
| [rds-oracle](rds-oracle/SKILL.md) | Cuando la tarea involucre `rds-oracle`; confirma el alcance en su `description`. |
| [rds-oss](rds-oss/SKILL.md) | Cuando la tarea involucre `rds-oss`; confirma el alcance en su `description`. |
| [rds-sqlserver](rds-sqlserver/SKILL.md) | Cuando la tarea involucre `rds-sqlserver`; confirma el alcance en su `description`. |
| [recovery-controller-setup](recovery-controller-setup/SKILL.md) | Cuando la tarea involucre `recovery-controller-setup`; confirma el alcance en su `description`. |
| [redshift-guide](redshift-guide/SKILL.md) | Cuando la tarea involucre `redshift-guide`; confirma el alcance en su `description`. |
| [resilience-hub-failure-mode-assessment](resilience-hub-failure-mode-assessment/SKILL.md) | Cuando la tarea involucre `resilience-hub-failure-mode-assessment`; confirma el alcance en su `description`. |
| [resilience-hub-getting-started](resilience-hub-getting-started/SKILL.md) | Cuando la tarea involucre `resilience-hub-getting-started`; confirma el alcance en su `description`. |
| [resilience-hub-multi-account](resilience-hub-multi-account/SKILL.md) | Cuando la tarea involucre `resilience-hub-multi-account`; confirma el alcance en su `description`. |
| [resilience-program-design](resilience-program-design/SKILL.md) | Cuando la tarea involucre `resilience-program-design`; confirma el alcance en su `description`. |
| [route53](route53/SKILL.md) | Cuando la tarea involucre `route53`; confirma el alcance en su `description`. |
| [routing-traffic-with-route53-and-cloudfront](routing-traffic-with-route53-and-cloudfront/SKILL.md) | Cuando la tarea involucre `routing-traffic-with-route53-and-cloudfront`; confirma el alcance en su `description`. |
| [securing-s3-buckets](securing-s3-buckets/SKILL.md) | Cuando la tarea involucre `securing-s3-buckets`; confirma el alcance en su `description`. |
| [setting-up-cloudtrail-multi-region](setting-up-cloudtrail-multi-region/SKILL.md) | Cuando la tarea involucre `setting-up-cloudtrail-multi-region`; confirma el alcance en su `description`. |
| [setting-up-cloudwatch-alarm-notifications](setting-up-cloudwatch-alarm-notifications/SKILL.md) | Cuando la tarea involucre `setting-up-cloudwatch-alarm-notifications`; confirma el alcance en su `description`. |
| [setting-up-cloudwatch-observability](setting-up-cloudwatch-observability/SKILL.md) | Cuando la tarea involucre `setting-up-cloudwatch-observability`; confirma el alcance en su `description`. |
| [setting-up-ec2-instance-profiles](setting-up-ec2-instance-profiles/SKILL.md) | Cuando la tarea involucre `setting-up-ec2-instance-profiles`; confirma el alcance en su `description`. |
| [shieldadvanced](shieldadvanced/SKILL.md) | Cuando la tarea involucre `shieldadvanced`; confirma el alcance en su `description`. |
| [sitetositevpn](sitetositevpn/SKILL.md) | Cuando la tarea involucre `sitetositevpn`; confirma el alcance en su `description`. |
| [storing-and-querying-vectors](storing-and-querying-vectors/SKILL.md) | Cuando la tarea involucre `storing-and-querying-vectors`; confirma el alcance en su `description`. |
| [testing-mwaa-workflow](testing-mwaa-workflow/SKILL.md) | Cuando la tarea involucre `testing-mwaa-workflow`; confirma el alcance en su `description`. |
| [timestream-influxdb](timestream-influxdb/SKILL.md) | Cuando la tarea involucre `timestream-influxdb`; confirma el alcance en su `description`. |
| [transitgateway](transitgateway/SKILL.md) | Cuando la tarea involucre `transitgateway`; confirma el alcance en su `description`. |
| [troubleshooting-application-failures](troubleshooting-application-failures/SKILL.md) | Cuando la tarea involucre `troubleshooting-application-failures`; confirma el alcance en su `description`. |
| [troubleshooting-efs](troubleshooting-efs/SKILL.md) | Cuando la tarea involucre `troubleshooting-efs`; confirma el alcance en su `description`. |
| [troubleshooting-s3-files](troubleshooting-s3-files/SKILL.md) | Cuando la tarea involucre `troubleshooting-s3-files`; confirma el alcance en su `description`. |
| [upgrading-mwaa-environments](upgrading-mwaa-environments/SKILL.md) | Cuando la tarea involucre `upgrading-mwaa-environments`; confirma el alcance en su `description`. |
| [waf](waf/SKILL.md) | Cuando la tarea involucre `waf`; confirma el alcance en su `description`. |

### Construcción y operación de agentes (8)

Crear, conectar, desplegar, diagnosticar o mejorar agentes según la tarea indicada.

| Skill y procedimiento | Cuándo consultarla |
| --- | --- |
| [agents-build](agents-build/SKILL.md) | Cuando la tarea involucre `agents-build`; confirma el alcance en su `description`. |
| [agents-connect](agents-connect/SKILL.md) | Cuando la tarea involucre `agents-connect`; confirma el alcance en su `description`. |
| [agents-debug](agents-debug/SKILL.md) | Cuando la tarea involucre `agents-debug`; confirma el alcance en su `description`. |
| [agents-deploy](agents-deploy/SKILL.md) | Cuando la tarea involucre `agents-deploy`; confirma el alcance en su `description`. |
| [agents-get-started](agents-get-started/SKILL.md) | Cuando la tarea involucre `agents-get-started`; confirma el alcance en su `description`. |
| [agents-harden](agents-harden/SKILL.md) | Cuando la tarea involucre `agents-harden`; confirma el alcance en su `description`. |
| [agents-optimize](agents-optimize/SKILL.md) | Cuando la tarea involucre `agents-optimize`; confirma el alcance en su `description`. |
| [agents-pay](agents-pay/SKILL.md) | Cuando la tarea involucre `agents-pay`; confirma el alcance en su `description`. |

### DevSecOps y agentes de seguridad (13)

Configurar o utilizar agentes de operaciones y seguridad según la tarea indicada.

| Skill y procedimiento | Cuándo consultarla |
| --- | --- |
| [analyzing-release-readiness](analyzing-release-readiness/SKILL.md) | Cuando la tarea involucre `analyzing-release-readiness`; confirma el alcance en su `description`. |
| [chatting-with-aws-devops-agent](chatting-with-aws-devops-agent/SKILL.md) | Cuando la tarea involucre `chatting-with-aws-devops-agent`; confirma el alcance en su `description`. |
| [coordinating-multi-space-devops-agent](coordinating-multi-space-devops-agent/SKILL.md) | Cuando la tarea involucre `coordinating-multi-space-devops-agent`; confirma el alcance en su `description`. |
| [diff-scanning-with-aws-security-agent](diff-scanning-with-aws-security-agent/SKILL.md) | Cuando la tarea involucre `diff-scanning-with-aws-security-agent`; confirma el alcance en su `description`. |
| [investigating-incidents-with-aws-devops-agent](investigating-incidents-with-aws-devops-agent/SKILL.md) | Cuando la tarea involucre `investigating-incidents-with-aws-devops-agent`; confirma el alcance en su `description`. |
| [pentesting-with-aws-security-agent](pentesting-with-aws-security-agent/SKILL.md) | Cuando la tarea involucre `pentesting-with-aws-security-agent`; confirma el alcance en su `description`. |
| [remediating-with-aws-security-agent](remediating-with-aws-security-agent/SKILL.md) | Cuando la tarea involucre `remediating-with-aws-security-agent`; confirma el alcance en su `description`. |
| [running-release-tests](running-release-tests/SKILL.md) | Cuando la tarea involucre `running-release-tests`; confirma el alcance en su `description`. |
| [scanning-with-aws-security-agent](scanning-with-aws-security-agent/SKILL.md) | Cuando la tarea involucre `scanning-with-aws-security-agent`; confirma el alcance en su `description`. |
| [setup](setup/SKILL.md) | Cuando la tarea involucre `setup`; confirma el alcance en su `description`. |
| [setup-devops-agent](setup-devops-agent/SKILL.md) | Cuando la tarea involucre `setup-devops-agent`; confirma el alcance en su `description`. |
| [setup-security-agent](setup-security-agent/SKILL.md) | Cuando la tarea involucre `setup-security-agent`; confirma el alcance en su `description`. |
| [threat-modeling-with-aws-security-agent](threat-modeling-with-aws-security-agent/SKILL.md) | Cuando la tarea involucre `threat-modeling-with-aws-security-agent`; confirma el alcance en su `description`. |

### Arquitectura y acompañamiento de proyectos (12)

Planificar, construir, migrar u operar proyectos según el objetivo indicado.

| Skill y procedimiento | Cuándo consultarla |
| --- | --- |
| [agent-advisor](agent-advisor/SKILL.md) | Cuando la tarea involucre `agent-advisor`; confirma el alcance en su `description`. |
| [architect-for-startups](architect-for-startups/SKILL.md) | Cuando la tarea involucre `architect-for-startups`; confirma el alcance en su `description`. |
| [azure-to-aws](azure-to-aws/SKILL.md) | Cuando la tarea involucre `azure-to-aws`; confirma el alcance en su `description`. |
| [contextual-offers-for-startups](contextual-offers-for-startups/SKILL.md) | Cuando la tarea involucre `contextual-offers-for-startups`; confirma el alcance en su `description`. |
| [gcp-to-aws](gcp-to-aws/SKILL.md) | Cuando la tarea involucre `gcp-to-aws`; confirma el alcance en su `description`. |
| [heroku-to-aws](heroku-to-aws/SKILL.md) | Cuando la tarea involucre `heroku-to-aws`; confirma el alcance en su `description`. |
| [knowledge-base-for-startups](knowledge-base-for-startups/SKILL.md) | Cuando la tarea involucre `knowledge-base-for-startups`; confirma el alcance en su `description`. |
| [llm-to-bedrock](llm-to-bedrock/SKILL.md) | Cuando la tarea involucre `llm-to-bedrock`; confirma el alcance en su `description`. |
| [operate-on-aws](operate-on-aws/SKILL.md) | Cuando la tarea involucre `operate-on-aws`; confirma el alcance en su `description`. |
| [prompt-library-for-startups](prompt-library-for-startups/SKILL.md) | Cuando la tarea involucre `prompt-library-for-startups`; confirma el alcance en su `description`. |
| [start-building-for-startups](start-building-for-startups/SKILL.md) | Cuando la tarea involucre `start-building-for-startups`; confirma el alcance en su `description`. |
| [tf-best-practices](tf-best-practices/SKILL.md) | Cuando la tarea involucre `tf-best-practices`; confirma el alcance en su `description`. |

## Recursos anidados y mantenimiento

[agents-pay para OpenClaw](agents-pay/packages/openclaw/skills/agents-pay/SKILL.md) es un recurso anidado de `agents-pay`, no una instalación principal adicional ni una entrada independiente del lock.

Al instalar o retirar skills, actualiza este catálogo, conserva la correspondencia con el lock y ejecuta desde la raíz:

```sh
python3 .agents/scripts/audit_skills.py
```

El verificador utiliza únicamente la biblioteca estándar de Python 3. Comprueba inventario, metadatos básicos, lectura de recursos, enlaces del contexto y rutas de entrada. No ejecuta las skills ni valida toda su semántica YAML. Consulta el [informe de auditoría](../context/skills-audit.md) para el alcance de la certificación.
