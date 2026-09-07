import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Batch static meshes by material while preserving every interactive hierarchy. */
export function batchMoonStatics(root:T.Group){
 root.updateMatrixWorld(true);
 const rootInverse=root.matrixWorld.clone().invert();
 const buckets=new Map<string,T.Mesh[]>();
 root.traverse(o=>{
  if(!(o instanceof T.Mesh)||Array.isArray(o.material)||o instanceof T.SkinnedMesh)return;
  for(let p:T.Object3D|null=o;p&&p!==root;p=p.parent)if(p.userData.moonId||p.userData.glazing)return;
  if(Object.keys(o.geometry.morphAttributes).length)return;
  const signature=Object.entries(o.geometry.attributes as Record<string,T.BufferAttribute>).map(([k,a])=>`${k}:${a.itemSize}:${a.normalized}`).sort().join(',');
  const key=`${o.material.uuid}:${signature}:${!!o.geometry.index}:${o.castShadow}:${o.receiveShadow}`;
  const items=buckets.get(key)??[];items.push(o);buckets.set(key,items);
 });
 let before=0,after=0;
 for(const meshes of buckets.values()){
  before+=meshes.length;after++;
  if(meshes.length<2)continue;
  const copies=meshes.map(o=>o.geometry.clone().applyMatrix4(rootInverse.clone().multiply(o.matrixWorld)));
  const merged=mergeGeometries(copies,false);copies.forEach(g=>g.dispose());
  if(!merged){after+=meshes.length-1;continue;}
  const mesh=new T.Mesh(merged,meshes[0].material);mesh.name='Batched static scenery';mesh.castShadow=meshes[0].castShadow;mesh.receiveShadow=meshes[0].receiveShadow;
  // Store merged vertices in root-local coordinates, including movable wheel groups.
  root.add(mesh);meshes.forEach(o=>o.removeFromParent());
 }
 return {before,after};
}

