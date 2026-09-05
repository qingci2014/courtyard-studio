import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** Authored and bevelled in Blender; named rigid parts retain interactive motion. */
export class Robot {
 readonly root = new T.Group();
 readonly ready: Promise<void>;
 private parts: Record<string,T.Object3D> = {};
 constructor() {
  this.ready = new GLTFLoader().loadAsync('/models/nexus-arm.glb').then(gltf => {
   for (const name of ['arm_upper','arm_forearm','joint_shoulder','joint_elbow','joint_wrist','arm_tool','grip_left','grip_right']) {
    const part = gltf.scene.getObjectByName(name);
    if (!part) throw new Error(`模型缺少可动部件：${name}`);
    this.parts[name]=part;
   }
   gltf.scene.traverse(object => {
    if(object instanceof T.Mesh) {
     object.castShadow=true;object.receiveShadow=true;
     const materials=Array.isArray(object.material)?object.material:[object.material];
     for(const material of materials) if(material instanceof T.MeshStandardMaterial) material.envMapIntensity=.8;
    }
   });
   this.root.add(gltf.scene);
  });
 }
 update(p:{x:number;y:number;z:number},closed:boolean,dt:number,_time:number) {
  if(!this.parts.arm_upper)return;
  const shoulder=new T.Vector3(0,.97,-2.25),wrist=new T.Vector3(p.x,p.y+.2,p.z);
  const delta=wrist.clone().sub(shoulder),d=delta.length();
  const up=new T.Vector3(0,1,0).addScaledVector(delta,-delta.y/(d*d)).normalize();
  const elbow=shoulder.clone().add(wrist).multiplyScalar(.5).addScaledVector(up,Math.sqrt(Math.max(.01,3.25**2-d*d/4)));
  for(const [name,a,b] of [['arm_upper',shoulder,elbow],['arm_forearm',elbow,wrist]] as const) {
   const part=this.parts[name]!;part.position.copy(a).add(b).multiplyScalar(.5);
   part.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());
  }
  const axis=new T.Vector3().crossVectors(delta,up).normalize();
  for(const [name,point] of [['joint_shoulder',shoulder],['joint_elbow',elbow],['joint_wrist',wrist]] as const){const part=this.parts[name]!;part.position.copy(point);part.quaternion.setFromUnitVectors(new T.Vector3(1,0,0),axis);}
  this.parts.arm_tool!.position.set(p.x,p.y,p.z);
  for(const [name,side] of [['grip_left',-1],['grip_right',1]] as const){const f=this.parts[name]!;f.position.x+=(side*(closed?.43:.58)-f.position.x)*Math.min(1,dt*12);}
 }
}
