import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ProductionTask } from './production-task';

const named=(o:T.Object3D,prefix:string)=>o.children.filter(c=>c.name.replaceAll('_',' ').startsWith(prefix));
/** Animates the exported Blender arm segments with a two-link IK solution. */
class AssemblyArm{
 private shells:T.Object3D[];private joints:T.Object3D[];private lights:T.Object3D[];private fingers:T.Object3D[];private wrist:T.Object3D;
 private rest=new Map<T.Object3D,{p:T.Vector3;q:T.Quaternion;s:T.Vector3}>();
 constructor(private root:T.Object3D){this.shells=named(root,'Arm shell').sort((a,b)=>a.name.localeCompare(b.name));this.joints=named(root,'Joint bearing').sort((a,b)=>a.position.y-b.position.y);this.lights=named(root,'Joint status').sort((a,b)=>a.position.y-b.position.y);this.fingers=named(root,'Gripper finger');this.wrist=named(root,'Gripper wrist')[0];if(this.shells.length!==3||this.joints.length!==3||!this.wrist)throw Error('机械臂模型缺少可动画部件');for(const o of [...this.shells,...this.joints,...this.lights,...this.fingers,this.wrist])this.rest.set(o,{p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone()});}
 reset(){this.rest.forEach((s,o)=>{o.position.copy(s.p);o.quaternion.copy(s.q);o.scale.copy(s.s);});}
 pose(tool:T.Vector3,closed:boolean){
  const d=this.root.worldToLocal(tool.clone()).add(new T.Vector3(0,.24,0)),a=new T.Vector3(0,1.2,0);
  const x=d.x,z=d.z,r=Math.max(.001,Math.hypot(x,z)),dy=d.y-a.y,L1=Math.hypot(.12,1.15),L2=Math.hypot(.78,.45)+Math.hypot(.38,.45);
  const distance=Math.min(L1+L2-.001,Math.max(.01,Math.hypot(r,dy))),angle=Math.atan2(dy,r)+Math.acos(T.MathUtils.clamp((L1*L1+distance*distance-L2*L2)/(2*L1*distance),-1,1));
  const b=new T.Vector3(x/r*L1*Math.cos(angle),a.y+L1*Math.sin(angle),z/r*L1*Math.cos(angle)),c=b.clone().lerp(d,Math.hypot(.78,.45)/L2),points=[a,b,c,d];
  for(let i=0;i<3;i++){const direction=points[i+1].clone().sub(points[i]);this.shells[i].position.copy(points[i]).add(points[i+1]).multiplyScalar(.5);this.shells[i].quaternion.setFromUnitVectors(new T.Vector3(0,0,1),direction.normalize());this.joints[i].position.copy(points[i]);this.lights[i].position.copy(points[i]).add(new T.Vector3(-z/r*.19,0,x/r*.19));const axis=new T.Vector3(-z/r,0,x/r);this.joints[i].quaternion.setFromUnitVectors(new T.Vector3(0,0,1),axis);this.lights[i].quaternion.copy(this.joints[i].quaternion);}
  this.wrist.position.copy(d).add(new T.Vector3(0,-.115,0));this.wrist.quaternion.copy(this.rest.get(this.wrist)!.q);
  this.fingers.forEach((f,i)=>{const spacing=closed?.16:.27;f.position.copy(d).add(new T.Vector3((i?1:-1)*spacing,-.33,0));});
 }
}
export class ProductionView{
 readonly task:ProductionTask;
 private cargo:T.Mesh;private arm:AssemblyArm;private path:T.Line;private lift=new T.Group();private forks:T.Mesh[]=[];private posts:T.Mesh[]=[];private activeRoute=-1;
 private changed:T.Object3D[]=[];private vehicle:T.Object3D;private wheels:T.Object3D[];private lastVehicle:T.Vector3;private wheelRest=new Map<T.Object3D,T.Quaternion>();private wheelAngle=0;
 private spark:T.Mesh;private disposed=false;
 constructor(private scene:T.Scene,private objects:Map<string,T.Object3D>,obstacles:ConstructorParameters<typeof ProductionTask>[0]){
  this.task=new ProductionTask(obstacles);this.vehicle=objects.get('AGV-03')!;this.arm=new AssemblyArm(objects.get('RB-02')!);this.wheels=[...named(this.vehicle,'Drive wheel'),...named(this.vehicle,'Wheel hub')];this.wheels.forEach(w=>this.wheelRest.set(w,w.quaternion.clone()));this.lastVehicle=this.vehicle.position.clone();
  for(const ob of [...named(this.vehicle,'Load tote'),...named(this.vehicle,'Marking AGV'),...named(objects.get('CV-02')!,'Material tray')]){this.changed.push(ob);ob.visible=false;}
  this.cargo=new T.Mesh(new RoundedBoxGeometry(.44,.4,.44,2,.025),new T.MeshStandardMaterial({color:0xd99434,metalness:.4,roughness:.28}));this.cargo.castShadow=true;this.cargo.userData.workpieceId='W-001';scene.add(this.cargo);
  const strap=new T.Mesh(new T.BoxGeometry(.455,.045,.455),new T.MeshStandardMaterial({color:0xf7feff,metalness:.4,roughness:.3}));strap.position.y=.065;this.cargo.add(strap);
  this.path=new T.Line(new T.BufferGeometry(),new T.LineBasicMaterial({color:0xc8852e,transparent:true,opacity:.7}));scene.add(this.path);
  const metal=new T.MeshStandardMaterial({color:0xb1c4cd,metalness:.7,roughness:.3});
  for(let i=0;i<2;i++){const fork=new T.Mesh(new T.BoxGeometry(.06,.055,1),metal);this.forks.push(fork);this.lift.add(fork);const post=new T.Mesh(new T.CylinderGeometry(.035,.045,1,12),metal);this.posts.push(post);this.lift.add(post);}scene.add(this.lift);
  this.spark=new T.Mesh(new T.RingGeometry(.25,.28,40),new T.MeshBasicMaterial({color:0xe9b955,transparent:true,opacity:.7,side:T.DoubleSide}));this.spark.rotation.x=-Math.PI/2;this.spark.position.set(-4.45,1.68,-4.1);scene.add(this.spark);this.sync();
 }
 tick(dt:number,person?:T.Vector3){const v=this.task.vehicle;const blocked=!!person&&Math.hypot(person.x-v[0],person.z-v[2])<1.7;this.task.tick(dt,blocked);this.sync();}
 sync(){const t=this.task;this.vehicle.position.fromArray(t.vehicle);this.vehicle.rotation.y=t.yaw;const travel=this.lastVehicle.distanceTo(this.vehicle.position);this.wheelAngle+=travel/.22;this.lastVehicle.copy(this.vehicle.position);this.wheels.forEach(w=>{w.quaternion.copy(this.wheelRest.get(w)!).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),this.wheelAngle));});
  this.cargo.position.fromArray(t.cargo);(this.cargo.material as T.MeshStandardMaterial).color.setHex(t.processed?0x63cf9c:0xd99434);
  if(t.status==='idle')this.arm.reset();else this.arm.pose(new T.Vector3(...t.tool),t.closed);
  this.lift.visible=t.status!=='idle'&&[1,7].includes(t.stage);if(this.lift.visible){const deck=new T.Vector3(...t.deck),cargo=new T.Vector3(...t.cargo),end=cargo.clone().add(new T.Vector3(0,-.23,0)),start=new T.Vector3(deck.x,end.y,deck.z);this.forks.forEach((f,i)=>{f.position.copy(start).add(end).multiplyScalar(.5);f.position.x+=(i?1:-1)*.17;const dir=end.clone().sub(start);f.scale.z=Math.max(.5,dir.length());if(dir.length()>.01)f.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),dir.normalize());});this.posts.forEach((p,i)=>{p.position.set(deck.x+(i?1:-1)*.3,(.78+end.y)/2,deck.z);p.scale.y=Math.max(.05,end.y-.78);});}
  const index=t.driving?t.routeIndex:-1;if(index!==this.activeRoute){this.activeRoute=index;this.path.geometry.dispose();this.path.geometry=new T.BufferGeometry().setFromPoints(index>=0?t.routes[index].map(p=>new T.Vector3(p[0],.06,p[2])):[]);}
  this.path.visible=t.status!=='idle'&&t.status!=='done'&&index>=0;this.spark.visible=t.stage===4&&t.status!=='idle';this.spark.scale.setScalar(1+Math.sin(t.stageTime*4)*.12);
 }
 reset(){this.task.reset();this.wheelAngle=0;this.lastVehicle.fromArray(this.task.vehicle);this.sync();}
 dispose(){if(this.disposed)return;this.disposed=true;this.arm.reset();this.changed.forEach(o=>o.visible=true);for(const o of [this.cargo,this.path,this.lift,this.spark]){this.scene.remove(o);o.traverse(n=>{if(n instanceof T.Mesh||n instanceof T.Line){n.geometry.dispose();const materials=Array.isArray(n.material)?n.material:[n.material];materials.forEach(m=>m.dispose());}});}}
}
