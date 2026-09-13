import {readFileSync,existsSync,readdirSync} from 'node:fs';import assert from 'node:assert/strict';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
for(const path of ['dist/index.html','dist/moon/index.html','dist/moon/cockpit/index.html','dist/moon/content/base.glb','dist/moon/content/cockpit.glb'])assert(existsSync(path),path);
const html=readFileSync('dist/moon/index.html','utf8');for(const match of html.matchAll(/(?:src|href)="(\/moon\/[^\"]+)"/g))assert(existsSync('dist'+match[1]),match[1]);assert(!html.includes('src="/assets/'));assert.equal(readFileSync('dist/moon/cockpit/index.html','utf8'),html);console.log('PASS: original homepage and both lunar entries exist; lunar bundles and models stay under /moon/.');
const cockpit=JSON.parse(readFileSync('moon/app/moon-cockpit-assets.json','utf8'));
for(const asset of [cockpit.model,cockpit.packed,...cockpit.textures]){
 const [path,query]=asset.split('?v='),bytes=readFileSync('dist/moon/content/'+path);
 assert.equal(createHash('sha256').update(bytes).digest('hex').slice(0,12),query,`${path} version must match its content`);
}
assert(gunzipSync(readFileSync('dist/moon/content/cockpit-packed.bin')).equals(readFileSync('dist/moon/content/cockpit.glb')));
console.log('PASS: compressed cockpit, fallback model and window textures are complete and versioned.');
const bedroom=JSON.parse(readFileSync('moon/app/moon-bedroom-assets.json','utf8'));
for(const asset of [bedroom.model,bedroom.packed,bedroom.lighting.file]){
 const [path,query]=asset.split('?v='),bytes=readFileSync('dist/moon/content/'+path);
 assert.equal(createHash('sha256').update(bytes).digest('hex').slice(0,12),query,`${path} version must match its content`);
}
assert(gunzipSync(readFileSync('dist/moon/content/bedroom-packed.bin')).equals(readFileSync('dist/moon/content/bedroom.glb')));
assert.equal(createHash('sha256').update(readFileSync('dist/moon/content/bedroom.glb')).digest('hex'),bedroom.lighting.modelSha256,'bedroom lighting matches the released geometry');
assert(existsSync('dist/moon/content/bedroom-layout.json'));
assert(!existsSync('dist/moon/bedroom-preview.html'),'local review page must not ship');
for(const file of readdirSync('dist/moon/assets').filter(file=>file.endsWith('.js'))){
 const code=readFileSync('dist/moon/assets/'+file,'utf8');
 assert(!/预览角度|床沿近景|空置角落|显示视角选择/.test(code),`${file} contains local preview controls`);
}
console.log('PASS: bedroom model, compressed transport, lighting and layout match; local preview controls are excluded.');
