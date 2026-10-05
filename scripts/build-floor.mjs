import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'floor/dist');
const target = path.join(root, 'dist/floor');
const html = await fs.readFile(path.join(source, 'index.html'), 'utf8');
if (!html.includes('src="/floor/assets/') || !html.includes('href="/floor/assets/')) {
  throw new Error('Build floor with --base=/floor/ before publishing the subdirectory');
}
for (const resource of [
  'walkthrough-runtime.js', 'walkthrough-licenses.txt', 'third-party-licenses.txt',
  'pdfjs/cmaps', 'pdfjs/standard_fonts', 'pdfjs/wasm', 'pdfjs/iccs',
  'fonts/NotoSansSC-Regular.ttf', 'fonts/LICENSE.NotoSansCJK',
  'source.html', 'source-info.txt', 'license.txt',
]) await fs.access(path.join(source, resource));
const assets = await fs.readdir(path.join(source, 'assets'));
if (!assets.some(name => /^libredwg-web-.*\.wasm$/.test(name))) {
  throw new Error('DWG WebAssembly reader is missing from the floor build');
}
await fs.mkdir(target, {recursive: true});
await fs.cp(source, target, {recursive: true});
// Hosts with clean HTML URLs resolve /floor through this sibling entry;
// directory-index hosts resolve /floor/. Both load the same absolute assets.
await fs.writeFile(path.join(root, 'dist/floor.html'), html);
console.log('Floor studio published to dist/floor with PDF, DWG, fonts, licenses and corresponding-source links.');
