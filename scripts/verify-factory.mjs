import fs from 'node:fs';import assert from 'node:assert/strict';import {build} from 'esbuild';
for(const path of ['dist/index.html','dist/moon/index.html','dist/moon/cockpit/index.html','dist/factory/index.html','dist/factory/models/workshop.glb'])assert(fs.existsSync(path),path);
const html=fs.readFileSync('dist/factory/index.html','utf8');assert(html.includes('/factory/assets/'));
const js=fs.readdirSync('dist/factory/assets').filter(n=>n.endsWith('.js')).map(n=>fs.readFileSync('dist/factory/assets/'+n,'utf8')).join('');assert(js.includes('/factory/api/command'));assert(js.includes('/factory/models/workshop.glb'));assert(!js.includes('WORKSHOP_MODEL_KEY'));assert(!/sk-[a-zA-Z0-9]{24,}/.test(js));
await build({entryPoints:['edge-functions/factory/api/command.ts'],outfile:'work/factory-edge-check.mjs',bundle:true,platform:'neutral',format:'esm'});
const edge=await import('../work/factory-edge-check.mjs');const config=await edge.onRequestGet({env:{}}).json();assert.equal(config.configured,false);
const request=new Request('https://studio.qingci.store/factory/api/command',{method:'POST',headers:{origin:'https://studio.qingci.store','content-type':'application/json'},body:JSON.stringify({text:'继续作业'})});const response=await edge.onRequestPost({request,env:{}});assert.equal(response.status,503);assert.equal((await response.json()).error,'大模型尚未配置，请先使用快捷指令。');
console.log('PASS: original routes preserved; factory model/assets/API scoped; no client secrets; EdgeOne handlers bundle and reject missing config');
