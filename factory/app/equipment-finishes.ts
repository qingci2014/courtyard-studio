import {Mesh,MeshStandardMaterial,type Object3D} from 'three';
/** Isolate per-device finishes from materials shared elsewhere in the workshop. */
export function applyEquipmentFinishes(root:Object3D){
 root.traverse(object=>{
  if(!(object instanceof Mesh))return;
  const name=object.name.replaceAll('_',' ');
  const whiteBase=['Machine plinth','Inspection cabinet','Packing enclosure'].some(prefix=>name.startsWith(prefix));
  const charging=name.startsWith('Charging dock');
  if(!whiteBase&&!charging)return;
  const original=Array.isArray(object.material)?object.material:[object.material];
  const materials=original.map(material=>{const copy=material.clone();if(copy instanceof MeshStandardMaterial){copy.color.setHex(charging?0xa6cedf:0xe3e7e2);copy.metalness=.08;copy.roughness=.65;}return copy;});
  object.material=Array.isArray(object.material)?materials:materials[0];
 });
}
