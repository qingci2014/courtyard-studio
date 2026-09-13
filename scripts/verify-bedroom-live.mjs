import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';

const origin='https://studio.qingci.store';
const manifest=JSON.parse(readFileSync('moon/app/moon-bedroom-assets.json','utf8'));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function request(path){
 const response=await fetch(origin+path,{signal:AbortSignal.timeout(30000),headers:{'Cache-Control':'no-cache'}});
 assert.equal(response.status,200,`${path}: HTTP ${response.status}`);
 return response;
}
async function text(path){return (await request(path)).text();}

try{
 const page=await text('/moon/?release='+manifest.lighting.modelSha256.slice(0,12));
 const entry=page.match(/<script[^>]+src="(\/moon\/assets\/[^"\s]+\.js)"/)?.[1];
 assert(entry,'production lunar entry is missing');
 const entryCode=await text(entry);
 const worldFile=entryCode.match(/moon-world-[\w-]+\.js/)?.[0];
 assert(worldFile,'production world bundle is missing');
 const worldCode=await text('/moon/assets/'+worldFile);
 assert(worldCode.includes(manifest.model),'the live world still references an older bedroom');
 assert(!/预览角度|床沿近景|空置角落|显示视角选择/.test(page+entryCode+worldCode),'local preview controls leaked into production');

 // The host can use a different zlib version; verify its exact packed hash and
 // the decoded model, rather than assuming Windows and Linux gzip bytes match.
 const packed=worldCode.match(/bedroom-packed\.bin\?v=[a-f0-9]{12}/)?.[0];
 assert(packed,'compressed bedroom reference is missing');
 const checks=await Promise.allSettled([
  (async()=>{
   const response=await request('/moon/content/'+packed);
   assert(!response.headers.get('content-type')?.includes('text/html'),'model returned an HTML fallback');
   const bytes=Buffer.from(await response.arrayBuffer());
   assert.equal(digest(bytes).slice(0,12),packed.split('?v=')[1]);
   assert.equal(digest(gunzipSync(bytes)),manifest.lighting.modelSha256);
   return {asset:'bedroom model',bytes:bytes.length,sha256:manifest.lighting.modelSha256};
  })(),
  (async()=>{
   const response=await request('/moon/content/'+manifest.lighting.file);
   assert(response.headers.get('content-type')?.includes('image/webp'),'lightmap content type');
   const bytes=Buffer.from(await response.arrayBuffer());
   assert.equal(digest(bytes),digest(readFileSync('moon/public/content/bedroom-lighting.webp')));
   return {asset:'lighting atlas',bytes:bytes.length};
  })(),
  (async()=>{
   const response=await request('/moon/content/bedroom-layout.json');
   assert.deepEqual(await response.json(),JSON.parse(readFileSync('moon/public/content/bedroom-layout.json','utf8')));
   return {asset:'bedroom layout',status:'matched'};
  })(),
  (async()=>{
   for(const path of ['/','/factory/'])assert((await text(path)).includes('<script'),`${path} entry unavailable`);
   return {asset:'existing site entries',status:'available'};
  })()
 ]);
 for(const result of checks){if(result.status==='rejected')throw result.reason;console.log(JSON.stringify(result.value));}
 console.log('LIVE BEDROOM VERIFIED: current model and lighting, compressed delivery, normal game entry, no preview controls.');
}catch(error){
 console.error('WAITING FOR DEPLOYMENT:',error.message);process.exitCode=2;
}
