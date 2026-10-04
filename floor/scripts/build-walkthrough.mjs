import {build} from 'vite';
import fs from 'node:fs/promises';

await build({configFile:false,publicDir:false,logLevel:'warn',build:{target:'es2022',outDir:'public',emptyOutDir:false,lib:{entry:'src/walkthrough-entry.js',name:'ZhujianWalkthrough',formats:['iife'],fileName:()=>'walkthrough-runtime.js'},rollupOptions:{output:{inlineDynamicImports:true}},minify:'esbuild'}});
const licenses=[];
for(const [name,file] of [['floorplan-3d','LICENSE.floorplan-3d'],['Three.js','node_modules/three/LICENSE'],['Clipper 6.4.2','LICENSE.clipper']])licenses.push(name+'\n\n'+await fs.readFile(file,'utf8'));
await fs.writeFile('public/walkthrough-licenses.txt',licenses.join('\n\n--------------------\n\n'));
console.log('Built offline walkthrough runtime.');
