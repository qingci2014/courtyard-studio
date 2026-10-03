import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {build} from 'esbuild';

const source = await fs.readFile('public/floor/index.html', 'utf8');
const moduleTag = /<script type="module">([\s\S]*?)<\/script>/;
const moduleCode = source.match(moduleTag)?.[1];
if (!moduleCode) throw new Error('Floor 3D module is missing');
// A single classic script also works in embedded browsers without import maps.
const result = await build({
  stdin: {contents: moduleCode, resolveDir: process.cwd(), sourcefile: 'floor-3d.js'},
  bundle: true, write: false, minify: true, format: 'iife', target: 'es2020',
  legalComments: 'eof',
  alias: {
    'three/addons': path.resolve('public/floor/vendor/three-r160/examples/jsm'),
    three: path.resolve('public/floor/vendor/three-r160/build/three.module.js'),
  },
});
const code = result.outputFiles[0].contents;
const version = crypto.createHash('sha256').update(code).digest('hex').slice(0, 12);
const filename = `engine-${version}.js`;
await fs.mkdir('dist/floor', {recursive: true});
await fs.writeFile(`dist/floor/${filename}`, code);
const html = source.replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '')
  .replace(moduleTag, `<script defer src="/floor/${filename}" onload="floor3dLoaded()" onerror="floor3dLoadFailed()"></script>`);
await fs.writeFile('dist/floor/index.html', html);
console.log(`Floor 3D bundled: ${filename} (${code.length} bytes)`);
