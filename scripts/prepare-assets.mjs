import { mkdir, copyFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
const files = ['index.html', 'swagger-ui.css', 'swagger-ui-bundle.js', 'swagger-ui-standalone-preset.js', 'favicon-16x16.png', 'favicon-32x32.png', 'oauth2-redirect.html'];
await rm('assets/swagger', { recursive: true, force: true });
await mkdir('assets/swagger', { recursive: true });
for (const file of files) await copyFile(resolve('node_modules/swagger-ui-dist', file), resolve('assets/swagger', file));
