import {readFile,writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const content=new URL('../moon/public/content/',import.meta.url);
const requested=process.argv.slice(2),targets=requested.length?requested:['base','cockpit','bedroom'];
if(targets.some(name=>!['base','cockpit','bedroom'].includes(name)))throw Error('Unknown lunar model');
for(const name of targets){
 const raw=await readFile(new URL(`${name}.glb`,content)),packed=gzipSync(raw,{level:9});
 await writeFile(new URL(`${name}-packed.bin`,content),packed);
 console.log(`${name} transfer: ${raw.length} -> ${packed.length} bytes`);
}
// Version every cockpit asset so an updated bundle cannot reuse an old model.
const versioned=async file=>`${file}?v=${createHash('sha256').update(await readFile(new URL(file,content))).digest('hex').slice(0,12)}`;
if(targets.includes('cockpit')){
 const manifest={model:await versioned('cockpit.glb'),packed:await versioned('cockpit-packed.bin'),textures:await Promise.all(['moon_diffuse','moon_nor_gl','moon_rough','earth'].map(name=>versioned(`cockpit-textures/${name}.webp`)))};
 await writeFile(new URL('../moon/app/moon-cockpit-assets.json',import.meta.url),JSON.stringify(manifest,null,2)+'\n');
}
if(targets.includes('bedroom')){
 const raw=await readFile(new URL('bedroom.glb',content));
 const gltf=JSON.parse(raw.toString('utf8',20,20+raw.readUInt32LE(12)));
 const baked=gltf.nodes.some(node=>node.extras?.bakedLighting);
 if(!baked||gltf.meshes.some(mesh=>mesh.primitives.some(p=>p.attributes.TEXCOORD_1===undefined)))throw Error('Bedroom requires the Cycles bake and UV1 atlas; rebuild with -- --bake');
 const metadata=JSON.parse(await readFile(new URL('bedroom-lighting.json',content),'utf8'));
 if(metadata.modelSha256!==createHash('sha256').update(raw).digest('hex'))throw Error('Bedroom lighting belongs to a different model');
 const manifest={model:await versioned('bedroom.glb'),packed:await versioned('bedroom-packed.bin'),lighting:{...metadata,file:await versioned('bedroom-lighting.webp')}};
 await writeFile(new URL('../moon/app/moon-bedroom-assets.json',import.meta.url),JSON.stringify(manifest,null,2)+'\n');
}
