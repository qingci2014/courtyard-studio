import { Mesh, MeshStandardMaterial, type Material, type Object3D } from 'three';

/** Temporary per-mesh materials keep shared white-model materials untouched. */
export class DeviceHighlight {
 private active: Object3D | null = null;
 private originals = new Map<Mesh, Material | Material[]>();
 private temporary: Material[] = [];
 set(object: Object3D | null, enabled = true) {
  const next = enabled ? object : null;
  if (next === this.active) return;
  this.clear();
  this.active = next;
  next?.traverse(node => {
   if (!(node instanceof Mesh)) return;
   const original = node.material as Material | Material[];
   const highlight = (material: Material) => {
    const copy = material.clone();
    if (copy instanceof MeshStandardMaterial) {
     copy.color.lerp(copy.emissive.clone().setHex(0x39bfff), .28);
     copy.emissive.setHex(0x159ed9);
     copy.emissiveIntensity = .65;
    }
    this.temporary.push(copy);
    return copy;
   };
   this.originals.set(node, original);
   node.material = Array.isArray(original) ? original.map(highlight) : highlight(original);
  });
 }
 clear() {
  this.originals.forEach((material, mesh) => { mesh.material = material; });
  this.temporary.forEach(material => material.dispose());
  this.originals.clear();
  this.temporary = [];
  this.active = null;
 }
}
