import {readFile,writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const content=new URL('../moon/public/content/',import.meta.url);
for(const name of ['base','cockpit']){
 const raw=await readFile(new URL(`${name}.glb`,content)),packed=gzipSync(raw,{level:9});
 await writeFile(new URL(`${name}-packed.bin`,content),packed);
 console.log(`${name} transfer: ${raw.length} -> ${packed.length} bytes`);
}
// Version every cockpit asset so an updated bundle cannot reuse an old model.
const versioned=async file=>`${file}?v=${createHash('sha256').update(await readFile(new URL(file,content))).digest('hex').slice(0,12)}`;
const manifest={model:await versioned('cockpit.glb'),packed:await versioned('cockpit-packed.bin'),textures:await Promise.all(['moon_diffuse','moon_nor_gl','moon_rough','earth'].map(name=>versioned(`cockpit-textures/${name}.webp`)))};
await writeFile(new URL('../moon/app/moon-cockpit-assets.json',import.meta.url),JSON.stringify(manifest,null,2)+'\n');
