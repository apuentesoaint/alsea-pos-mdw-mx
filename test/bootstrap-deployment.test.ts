import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const library = resolve('node_modules/serverless/lib/plugins/aws');
const { default: Infrastructure } = await import(pathToFileURL(resolve('plugins/infrastructure.mjs')).href);
const frameworkMethods = await Promise.all([
  'deploy/lib/create-stack', 'lib/get-shared-stack-action-params', 'lib/get-create-stack-params',
  'lib/get-create-change-set-params', 'lib/get-update-stack-params', 'lib/get-execute-change-set-params',
].map(async name => (await import(pathToFileURL(`${library}/${name}.js`).href)).default));

for (const deploymentMethod of ['direct', 'changesets']) {
  for (const exists of [false, true]) {
    test(`Serverless 3: ${deploymentMethod}, stack ${exists ? 'existente' : 'nuevo'}, parámetros válidos en cada fase`, async () => {
      const parameters = [
        { ParameterKey: 'GatewayLogsRoleArn', ParameterValue: 'arn:aws:iam::123456789012:role/test-only' },
        { ParameterKey: 'SecuritySecretKmsKeyArn', ParameterValue: '' },
      ];
      const serviceProvider = {
        deploymentMethod, stackParameters: parameters,
        coreCloudFormationTemplate: { Resources: { ServerlessDeploymentBucket: { Type: 'AWS::S3::Bucket' } } },
      };
      const requests: string[] = [];
      const provider = {
        naming: { getStackName: () => 'bootstrap-test', getStackChangeSetName: () => 'bootstrap-test-change' },
        getStage: () => 'dev', getCustomDeploymentRole: () => undefined,
        isS3TransferAccelerationEnabled: () => false,
        request: async (_service: string, operation: string, params: any) => {
          requests.push(operation);
          if (operation === 'describeStacks') {
            if (!exists) throw new Error('Stack does not exist');
            return { Stacks: [{ StackStatus: 'UPDATE_COMPLETE' }] };
          }
          if (operation === 'createStack' || operation === 'createChangeSet') {
            const template = JSON.parse(params.TemplateBody);
            for (const parameter of params.Parameters) {
              assert.ok(Object.hasOwn(template.Parameters ?? {}, parameter.ParameterKey), 'Parameter values specified for a template which does not require them.');
            }
          }
          return {};
        },
      };
      const serverless = { service: { provider: serviceProvider } };
      const deploy = Object.assign({
        serverless, provider,
        waitForChangeSetCreation: async () => ({ Changes: [{}] }),
        monitorStack: async () => {},
      }, ...frameworkMethods);
      const plugin = new Infrastructure(serverless);
      // Estos son los hooks y el createStack reales utilizados también por deploy --package.
      plugin.hooks['before:aws:deploy:deploy:createStack']();
      await deploy.createStack();
      plugin.hooks['after:aws:deploy:deploy:createStack']();
      assert.equal(requests.includes(deploymentMethod === 'direct' ? 'createStack' : 'createChangeSet'), !exists);
      assert.equal(serviceProvider.stackParameters, parameters);
      const update = deploy.getUpdateStackParams({ templateUrl: 'https://example.com/template.json' });
      assert.deepEqual(update.Parameters, parameters, 'La plantilla completa conserva el rol y el vacío explícito de KMS');
    });
  }
}
