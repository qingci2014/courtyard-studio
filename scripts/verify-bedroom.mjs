import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {Box3,Matrix4,Vector3,Quaternion} from 'three';

const content=new URL('../moon/public/content/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('../moon/app/moon-bedroom-assets.json',import.meta.url)));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const asset=async name=>{
 const [file,query]=name.split('?v='),bytes=await readFile(new URL(file,content));
 assert.equal(query,digest(bytes).slice(0,12),`${file} cache version`);return bytes;
};
const raw=await asset(manifest.model),packed=await asset(manifest.packed),light=await asset(manifest.lighting.file);
assert.ok(gunzipSync(packed).equals(raw),'packed bedroom must round-trip exactly');
assert.equal(manifest.lighting.modelSha256,digest(raw),'lighting must match the exact baked model');
assert.equal(manifest.lighting.uvChannel,1);assert.equal(manifest.lighting.encoding,'srgb-scaled-irradiance');
const jsonSize=raw.readUInt32LE(12),gltf=JSON.parse(raw.toString('utf8',20,20+jsonSize)),binaryStart=28+jsonSize;
assert.ok(gltf.nodes.some(n=>n.extras?.bakedLighting));
const bounds=new Box3(),point=new Vector3();let count=0;
function attribute(index,visit){
 const accessor=gltf.accessors[index],view=gltf.bufferViews[accessor.bufferView];
 assert.equal(accessor.componentType,5126);const width=accessor.type==='VEC2'?2:3;
 const start=binaryStart+(view.byteOffset??0)+(accessor.byteOffset??0),stride=view.byteStride??width*4;
 for(let i=0;i<accessor.count;i++)visit(Array.from({length:width},(_,j)=>raw.readFloatLE(start+i*stride+j*4)));
}
function node(index,parent=new Matrix4()){
 const n=gltf.nodes[index],local=n.matrix?new Matrix4().fromArray(n.matrix):new Matrix4().compose(new Vector3().fromArray(n.translation??[0,0,0]),new Quaternion().fromArray(n.rotation??[0,0,0,1]),new Vector3().fromArray(n.scale??[1,1,1]));
 const world=parent.clone().multiply(local);
 if(n.mesh!==undefined)for(const p of gltf.meshes[n.mesh].primitives){
  assert.notEqual(p.attributes.TEXCOORD_1,undefined,'every surface needs its non-overlapping lighting UVs');
  attribute(p.attributes.TEXCOORD_1,uv=>assert.ok(uv.every(v=>Number.isFinite(v)&&v>=-.00001&&v<=1.00001),'UV1 is inside atlas'));
  attribute(p.attributes.POSITION,v=>{bounds.expandByPoint(point.fromArray(v).applyMatrix4(world));count++;});
 }
 for(const child of n.children??[])node(child,world);
}
for(const root of gltf.scenes[gltf.scene??0].nodes)node(root);
console.log('Bedroom bounds:',bounds.min.toArray(),bounds.max.toArray());
assert.ok(bounds.min.x>-3.95&&bounds.max.x<3.95&&bounds.min.z>-32.15&&bounds.max.z<-21.95,'insert remains inside the bedroom; baking occluders must not export');
console.log(JSON.stringify({vertices:count,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},modelTransfer:packed.length,lightingTransfer:light.length,status:'PASS'},null,2));
