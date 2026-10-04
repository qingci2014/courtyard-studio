import fs from 'node:fs/promises';
await import('./build-walkthrough.mjs');
await fs.mkdir('public/pdfjs',{recursive:true});
for(const part of['cmaps','standard_fonts','wasm','iccs'])await fs.cp(`node_modules/pdfjs-dist/${part}`,`public/pdfjs/${part}`,{recursive:true});
const parts=[];
for(const [name,file] of [['dxf-parser 1.1.2','node_modules/dxf-parser/LICENSE'],['loglevel','node_modules/loglevel/LICENSE-MIT']])parts.push(name+'\n\n'+await fs.readFile(file,'utf8'));
for(const [name,file] of [['floorplan-3d','LICENSE.floorplan-3d'],['Three.js','node_modules/three/LICENSE'],['PDF.js','node_modules/pdfjs-dist/LICENSE'],['Clipper 6.4.2','LICENSE.clipper']])parts.push(name+'\n\n'+await fs.readFile(file,'utf8'));
await fs.writeFile('public/third-party-licenses.txt',parts.join('\n\n--------------------\n\n'));
console.log('Prepared local PDF resources and third-party licenses.');
