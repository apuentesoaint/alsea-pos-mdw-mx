import { registerHooks } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Adaptación de consumidores de terceros; no modifica node_modules ni el código Lambda.
// Cada cambio está limitado por ruta, hash y coincidencia única. Una actualización
// del consumidor obliga a revisar el adaptador antes de volver a ejecutar el CLI.
const adaptations = [
  {
    path: '/node_modules/serverless/lib/plugins/aws/invoke-local/index.js',
    sha256: 'd42ba7ccbb43d9c5fabce47c48f1d7e43847b51cd5f92fa99ba813568c4e7315',
    replacements: [['const decompress = ', 'const { default: decompress } = ']],
  },
  {
    path: '/node_modules/@serverless/dashboard-plugin/lib/deployment/parse.js',
    sha256: '9937b273f48c27107b09f2d896239efa201e3c67cc41d0a5ea9bf581cbd72cbb',
    replacements: [['const simpleGit = ', 'const { simpleGit } = ']],
  },
  {
    path: '/node_modules/@serverless/utils/download.js',
    sha256: '860cf6d1d05d9db847bca08ffd71674cb637f9bcff31f1bdc49120f8791642f4',
    replacements: [
      ['const decompress = ', 'const { default: decompress } = '],
      ['FileType.fromBuffer(data)', 'FileType.fileTypeFromBuffer(data)'],
    ],
  },
];

export function adaptThirdPartySource(url, source) {
  if (!url.startsWith('file:')) return source;
  const adaptation = adaptations.find(entry => fileURLToPath(url).replaceAll('\\', '/').endsWith(entry.path));
  if (!adaptation) return source;
  const text = typeof source === 'string' ? source : Buffer.from(source).toString('utf8');
  if (createHash('sha256').update(text).digest('hex') !== adaptation.sha256) {
    throw new Error('Cambió un consumidor de herramientas: revisar adaptación ESM y hash antes de continuar');
  }
  return adaptation.replacements.reduce((result, [before, after]) => {
    if (result.split(before).length !== 2) throw new Error('La adaptación de herramientas requiere una coincidencia única');
    return result.replace(before, after);
  }, text);
}

if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('Se requiere Node.js 24');
registerHooks({
  load(url, context, nextLoad) {
    const result = nextLoad(url, context);
    if (result.source == null) return result;
    return { ...result, source: adaptThirdPartySource(url, result.source) };
  },
});
