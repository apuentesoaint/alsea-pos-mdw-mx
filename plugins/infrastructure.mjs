/** Ordena logs y limita los parámetros de la creación provisional de Serverless 3. */
export default class Infrastructure {
  constructor(serverless) {
    let stackParameters;
    this.hooks = {
      'before:aws:deploy:deploy:createStack': () => {
        const provider = serverless.service.provider;
        stackParameters = provider.stackParameters;
        // La plantilla provisional solo crea el bucket; aún no declara los parámetros propios.
        const declared = provider.coreCloudFormationTemplate?.Parameters ?? {};
        if (stackParameters) provider.stackParameters = stackParameters.filter(parameter => Object.hasOwn(declared, parameter.ParameterKey));
      },
      'after:aws:deploy:deploy:createStack': () => {
        const provider = serverless.service.provider;
        if (stackParameters === undefined) delete provider.stackParameters;
        else provider.stackParameters = stackParameters;
      },
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
