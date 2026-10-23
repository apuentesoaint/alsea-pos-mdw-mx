/** Extensión acotada del esquema de Serverless 3.40.0; nunca cambia el runtime. */
export default class Node24 {
  constructor(serverless) {
    const version = serverless.version;
    if (version !== '3.40.0') throw new Error(`Framework no verificado: ${version}`);
    const schema = serverless.configSchemaHandler.schema.definitions.awsLambdaRuntime;
    if (!Array.isArray(schema?.enum)) throw new Error('Esquema AWS incompatible');
    serverless.configSchemaHandler.defineProvider('aws', {
      definitions: {
        awsLambdaRuntime: { ...schema, enum: [...new Set([...schema.enum, 'nodejs24.x'])] },
      },
    });
  }
}
