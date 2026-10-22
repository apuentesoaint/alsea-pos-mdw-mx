// Infraestructura CloudFormation construida como datos; módulo ESM sin peticiones AWS.
const ref = name => ({ Ref: name });
const arn = name => ({ 'Fn::GetAtt': [name, 'Arn'] });
const sub = value => ({ 'Fn::Sub': value });
const retained = { DeletionPolicy: 'Retain', UpdateReplacePolicy: 'Retain' };
const context = (why, must = []) => ({ 'com.aws.cloudformation.Context': { why, must } });
const resourcesMap = {
  TransactionsTable: {
    Type: 'AWS::DynamoDB::Table', ...retained,
    Metadata: context('Transacciones, pagos y referencias pendientes con consistencia fuerte.', ['No TTL ni Streams', 'Retener datos al reemplazar']),
    Properties: {
      BillingMode: 'PAY_PER_REQUEST', KeySchema: [{ AttributeName: 'PK', KeyType: 'HASH' }, { AttributeName: 'SK', KeyType: 'RANGE' }],
      AttributeDefinitions: [{ AttributeName: 'PK', AttributeType: 'S' }, { AttributeName: 'SK', AttributeType: 'S' }],
      PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true, RecoveryPeriodInDays: 35 },
      DeletionProtectionEnabled: { 'Fn::If': ['IsProduction', true, false] },
    },
  },
  DetailsBucket: {
    Type: 'AWS::S3::Bucket', ...retained,
    Metadata: context('Detalles mayores de 300 KiB sin imponer el límite DynamoDB al contrato.'),
    Properties: {
      PublicAccessBlockConfiguration: { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true },
      BucketEncryption: { ServerSideEncryptionConfiguration: [{ ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } }] },
      VersioningConfiguration: { Status: 'Enabled' }, OwnershipControls: { Rules: [{ ObjectOwnership: 'BucketOwnerEnforced' }] },
    },
  },
  DetailsBucketPolicy: {
    Type: 'AWS::S3::BucketPolicy', ...retained, Properties: { Bucket: ref('DetailsBucket'), PolicyDocument: { Version: '2012-10-17', Statement: [
      { Sid: 'HttpsOnly', Effect: 'Deny', Principal: '*', Action: 's3:*', Resource: [arn('DetailsBucket'), sub('${DetailsBucket.Arn}/*')], Condition: { Bool: { 'aws:SecureTransport': 'false' } } },
    ] } },
  },
  SecretsKey: {
    Type: 'AWS::KMS::Key', ...retained, Metadata: context('Clave dedicada para secretos del entorno; rotación automática de KMS.'),
    Properties: { Description: 'Cifrado de secretos Cuponera', EnableKeyRotation: true, KeyPolicy: { Version: '2012-10-17', Statement: [
      { Sid: 'AccountAdministration', Effect: 'Allow', Principal: { AWS: sub('arn:${AWS::Partition}:iam::${AWS::AccountId}:root') }, Action: 'kms:*', Resource: '*' },
    ] } },
  },
  ApiGatewayLoggingRole: {
    Type: 'AWS::IAM::Role', Condition: 'CreateGatewayLogsRole', ...retained, Properties: { AssumeRolePolicyDocument: { Version: '2012-10-17', Statement: [
      { Effect: 'Allow', Principal: { Service: 'apigateway.amazonaws.com' }, Action: 'sts:AssumeRole' },
    ] }, Policies: [{ PolicyName: 'GatewayLogs', PolicyDocument: { Version: '2012-10-17', Statement: [
      { Effect: 'Allow', Action: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:DescribeLogStreams', 'logs:PutLogEvents', 'logs:GetLogEvents', 'logs:FilterLogEvents'],
        Resource: [sub('arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:API-Gateway-Execution-Logs_*'), sub('arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/api-gateway/*')] },
      { Effect: 'Allow', Action: ['logs:DescribeLogGroups'], Resource: '*' },
    ] } }] },
  },
  ApiGatewayAccount: { Type: 'AWS::ApiGateway::Account', ...retained, Properties: { CloudWatchRoleArn: { 'Fn::If': ['UseExistingGatewayLogsRole', '${param:gatewayLogsRoleArn, ""}', arn('ApiGatewayLoggingRole')] } } },
  GatewayExecutionLogGroup: { Type: 'AWS::Logs::LogGroup', ...retained, Metadata: context('Retención explícita de los registros de ejecución del gateway.'),
    Properties: { LogGroupName: sub('API-Gateway-Execution-Logs_${ApiGatewayRestApi}/${sls:stage}'), RetentionInDays: '${self:custom.stageSettings.logRetention}' } },
};
for (const [name, description] of Object.entries({ AuthSecret: 'Credenciales clientId/clientSecret del consumidor', SigningSecret: 'Firma JWT keyBase64',
  CuponeraSecret: 'Autenticación Basic Cuponera, campo basic', StarbucksSecret: 'Credenciales clientId/clientSecret Starbucks', MigrationSecret: 'Conexión SQL de uso exclusivo para migración' })) {
  resourcesMap[name] = { Type: 'AWS::SecretsManager::Secret', ...retained,
    Metadata: context('Contenedor sin valores: el propietario carga la versión por un canal seguro.', ['Nunca copiar credenciales al template', 'Rotación coordinada con el proveedor']),
    Properties: { Description: description, KmsKeyId: arn('SecretsKey'), Tags: [{ Key: 'Stage', Value: '${sls:stage}' }] } };
}
const capabilities = {
  Auth: { fn: 'auth', secrets: ['AuthSecret', 'SigningSecret'] },
  Validate: { fn: 'validate', secrets: ['SigningSecret', 'CuponeraSecret', 'StarbucksSecret'], db: ['dynamodb:PutItem'], s3: ['s3:PutObject', 's3:DeleteObjectVersion'] },
  Redeem: { fn: 'redeem', secrets: ['SigningSecret', 'CuponeraSecret', 'StarbucksSecret'], db: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:DeleteItem'], s3: ['s3:GetObject', 's3:GetObjectVersion'] },
  Generate: { fn: 'generate', secrets: ['SigningSecret', 'CuponeraSecret'] },
  Latest: { fn: 'latest', secrets: ['SigningSecret'], db: ['dynamodb:Query'] },
  Technical: { fn: 'technical', secrets: ['SigningSecret'] },
};
for (const [name, capability] of Object.entries(capabilities)) {
  const statements = [
    { Effect: 'Allow', Action: ['logs:CreateLogStream', 'logs:PutLogEvents'], Resource: sub(`arn:\${AWS::Partition}:logs:\${AWS::Region}:\${AWS::AccountId}:log-group:/aws/lambda/\${self:service}-\${sls:stage}-${capability.fn}:*`) },
    { Effect: 'Allow', Action: ['secretsmanager:GetSecretValue'], Resource: capability.secrets.map(ref), Condition: { Bool: { 'aws:SecureTransport': 'true' } } },
    { Effect: 'Allow', Action: ['kms:Decrypt'], Resource: arn('SecretsKey'), Condition: { StringEquals: { 'kms:ViaService': sub('secretsmanager.${AWS::Region}.amazonaws.com') } } },
  ];
  if (capability.db) statements.push({ Effect: 'Allow', Action: capability.db, Resource: arn('TransactionsTable') });
  if (capability.s3) statements.push({ Effect: 'Allow', Action: capability.s3, Resource: sub('${DetailsBucket.Arn}/details/*') });
  resourcesMap[`${name}Role`] = { Type: 'AWS::IAM::Role', Metadata: context(`Permisos mínimos de la operación ${capability.fn}.`), Properties: {
    AssumeRolePolicyDocument: { Version: '2012-10-17', Statement: [{ Effect: 'Allow', Principal: { Service: 'lambda.amazonaws.com' }, Action: 'sts:AssumeRole' }] },
    Policies: [{ PolicyName: 'Runtime', PolicyDocument: { Version: '2012-10-17', Statement: statements } }],
  } };
}
resourcesMap.MigrationPolicy = {
  Type: 'AWS::IAM::ManagedPolicy', Metadata: context('Política para un rol temporal del operador; no se adjunta a ninguna Lambda.'),
  Properties: { Description: 'Permisos de importación y conciliación Cuponera', PolicyDocument: { Version: '2012-10-17', Statement: [
    { Effect: 'Allow', Action: ['secretsmanager:GetSecretValue'], Resource: ref('MigrationSecret'), Condition: { Bool: { 'aws:SecureTransport': 'true' } } },
    { Effect: 'Allow', Action: ['kms:Decrypt'], Resource: arn('SecretsKey'), Condition: { StringEquals: { 'kms:ViaService': sub('secretsmanager.${AWS::Region}.amazonaws.com') } } },
    { Effect: 'Allow', Action: ['dynamodb:GetItem', 'dynamodb:Query', 'dynamodb:Scan', 'dynamodb:PutItem'], Resource: arn('TransactionsTable') },
    { Effect: 'Allow', Action: ['s3:GetObject', 's3:GetObjectVersion', 's3:PutObject', 's3:DeleteObjectVersion'], Resource: sub('${DetailsBucket.Arn}/details/*') },
  ] } },
};
for (const [id, metric, namespace, threshold] of [
  ['TechnicalErrorsAlarm', 'TechnicalErrors', 'Cuponera', 1], ['UncertainRedemptionsAlarm', 'UncertainRedemptions', 'Cuponera', 1],
  ['ExternalErrorsAlarm', 'ExternalErrors', 'Cuponera', 5], ['PersistenceErrorsAlarm', 'PersistenceErrors', 'Cuponera', 1],
]) resourcesMap[id] = { Type: 'AWS::CloudWatch::Alarm', Properties: {
  AlarmDescription: `Revisar ${metric} en CloudWatch Logs Insights.`, Namespace: namespace, MetricName: metric,
  Dimensions: [{ Name: 'Stage', Value: '${sls:stage}' }], Statistic: 'Sum', Period: 60, EvaluationPeriods: 1,
  Threshold: threshold, ComparisonOperator: 'GreaterThanOrEqualToThreshold', TreatMissingData: 'notBreaching',
} };
resourcesMap.ThrottlesAlarm = { Type: 'AWS::CloudWatch::Alarm', Properties: {
  AlarmDescription: 'ThrottledRequests requiere TableName y Operation; sumar las operaciones del middleware.',
  Metrics: [
    ...['GetItem', 'Query', 'PutItem', 'TransactWriteItems'].map((operation, index) => ({ Id: `t${index}`, ReturnData: false,
      MetricStat: { Metric: { Namespace: 'AWS/DynamoDB', MetricName: 'ThrottledRequests', Dimensions: [{ Name: 'TableName', Value: ref('TransactionsTable') }, { Name: 'Operation', Value: operation }] }, Period: 60, Stat: 'Sum' } })),
    { Id: 'total', Expression: 'SUM(METRICS())', ReturnData: true },
  ], EvaluationPeriods: 1, Threshold: 1, ComparisonOperator: 'GreaterThanOrEqualToThreshold', TreatMissingData: 'notBreaching',
} };
for (const metric of ['Throttles', 'Errors']) resourcesMap[`Lambda${metric}Alarm`] = { Type: 'AWS::CloudWatch::Alarm', Properties: {
  AlarmDescription: `Lambda ${metric}: incluye fallos previos a la frontera de errores de aplicación.`,
  Metrics: [
    ...Object.values(capabilities).map((capability, index) => ({ Id: `m${index}`, ReturnData: false,
      MetricStat: { Metric: { Namespace: 'AWS/Lambda', MetricName: metric, Dimensions: [{ Name: 'FunctionName', Value: sub(`\${self:service}-\${sls:stage}-${capability.fn}`) }] }, Period: 60, Stat: 'Sum' } })),
    { Id: 'total', Expression: 'SUM(METRICS())', ReturnData: true },
  ], EvaluationPeriods: 1, Threshold: 1, ComparisonOperator: 'GreaterThanOrEqualToThreshold', TreatMissingData: 'notBreaching',
} };
resourcesMap.LatencyAlarm = { Type: 'AWS::CloudWatch::Alarm', Properties: {
  AlarmDescription: 'p95 mayor a 3 segundos durante dos minutos; hipótesis inicial de QA.', Namespace: 'Cuponera', MetricName: 'Duration',
  Dimensions: [{ Name: 'Stage', Value: '${sls:stage}' }], ExtendedStatistic: 'p95', Period: 60, EvaluationPeriods: 2,
  Threshold: 3000, ComparisonOperator: 'GreaterThanThreshold', TreatMissingData: 'notBreaching', EvaluateLowSampleCountPercentile: 'ignore',
} };
resourcesMap.GatewayDefault4xx = { Type: 'AWS::ApiGateway::GatewayResponse', Properties: {
  RestApiId: ref('ApiGatewayRestApi'), ResponseType: 'DEFAULT_4XX', ResponseTemplates: {
    'application/json': '{"uid":"$context.requestId","timestamp":"$context.requestTime","status":$context.status,"type":"error","message":"Solicitud no procesada por el gateway.","helpUrl":"$context.resourcePath","success":false,"data":null}',
  },
} };
resourcesMap.GatewayDefault5xx = { Type: 'AWS::ApiGateway::GatewayResponse', Properties: {
  RestApiId: ref('ApiGatewayRestApi'), ResponseType: 'DEFAULT_5XX', ResponseTemplates: {
    'application/json': '{"uid":"$context.requestId","timestamp":"$context.requestTime","status":$context.status,"type":"error","message":"No fue posible completar su solicitud. ","helpUrl":"$context.resourcePath","success":false,"data":null}',
  },
} };
resourcesMap.OperationsDashboard = { Type: 'AWS::CloudWatch::Dashboard', Properties: { DashboardBody: JSON.stringify({ widgets: [
  { type: 'metric', x: 0, y: 0, width: 12, height: 6, properties: { title: 'Errores de aplicación', region: 'us-east-1', stat: 'Sum', period: 60,
    metrics: ['TechnicalErrors', 'ExternalErrors', 'PersistenceErrors', 'UncertainRedemptions'].map(metric => ['Cuponera', metric, 'Stage', '${sls:stage}']) } },
  { type: 'metric', x: 12, y: 0, width: 12, height: 6, properties: { title: 'Latencia p95/p99', region: 'us-east-1', period: 60,
    metrics: [['Cuponera', 'Duration', 'Stage', '${sls:stage}', { stat: 'p95' }], ['Cuponera', 'Duration', 'Stage', '${sls:stage}', { stat: 'p99' }]] } },
] }) } };
export const resources = {
  Description: 'Middleware Cuponera: Node.js 24, ESM y SDK v3; conservar contratos Java y datos al reemplazar recursos.',
  Metadata: { AWSToolsMetrics: { AWSAgentToolkit: 'aws-cloudformation@3' } },
  Conditions: { IsProduction: { 'Fn::Equals': ['${sls:stage}', 'prod'] },
    CreateGatewayLogsRole: { 'Fn::Equals': ['${param:gatewayLogsRoleArn, ""}', ''] },
    UseExistingGatewayLogsRole: { 'Fn::Not': [{ 'Fn::Equals': ['${param:gatewayLogsRoleArn, ""}', ''] }] },
  },
  Resources: resourcesMap,
  extensions: { ApiGatewayRestApi: { DependsOn: ['ApiGatewayAccount'] } },
  Outputs: {
    TransactionsTableName: { Value: ref('TransactionsTable') }, DetailsBucketName: { Value: ref('DetailsBucket') },
    MigrationPolicyArn: { Value: ref('MigrationPolicy') }, SecretsKeyArn: { Value: arn('SecretsKey') },
    ...Object.fromEntries(['AuthSecret', 'SigningSecret', 'CuponeraSecret', 'StarbucksSecret', 'MigrationSecret'].map(name => [`${name}Arn`, { Value: ref(name) }])),
  },
};
