/** Ordena la creación del stage y sus logs sin recursos Lambda auxiliares. */
export default class Infrastructure {
  constructor(serverless) {
    this.hooks = {
      'after:aws:package:finalize:mergeCustomProviderResources': () => {
        const resources = serverless.service.provider.compiledCloudFormationTemplate.Resources;
        for (const resource of Object.values(resources)) if (resource.Type === 'AWS::ApiGateway::Deployment') {
          const existing = resource.DependsOn == null ? [] : Array.isArray(resource.DependsOn) ? resource.DependsOn : [resource.DependsOn];
          resource.DependsOn = [...new Set([...existing, 'GatewayExecutionLogGroup'])];
        }
      },
    };
  }
}
