import {CompanionFace} from './moon-companion-face';
import * as T from 'three';
import {batchMoonStatics} from './moon-batching';
export type CompanionMood='idle'|'listening'|'thinking';
/** Slow indoor patrol; restricted to the connected bedroom and outer workroom. */
export class MoonCompanion{
 private face?:CompanionFace;readonly root=new T.Group();private floating=new T.Group();private eyes:T.Object3D[]=[];private arms:{object:T.Object3D;rest:T.Quaternion}[]=[];private mouth?:T.Object3D;private plume:T.Mesh;private time=0;private waypoint=1;private rest=2;private route=[[.65,-24],[-.65,-25.5],[.65,-27.5],[-.65,-28.6],[.65,-24],[.65,-20.5],[.65,-16],[.65,-10],[-.65,-9],[-.65,-14.8],[.65,-16],[.65,-20.5],[.65,-24]];
 constructor(model:T.Group){
  this.root.name='SELENE indoor companion';this.root.position.set(.65,1.55,-24);this.root.rotation.y=-Math.PI/2;
  this.floating.name='Companion hover rig';this.floating.position.y=0;this.floating.scale.setScalar(.9);this.floating.add(model);this.root.add(this.floating);
  model.traverse(o=>{const id=o.userData.moonId as string|undefined;if(id?.startsWith('companion-eye'))this.eyes.push(o);if(id?.startsWith('companion-arm'))this.arms.push({object:o,rest:o.quaternion.clone()});if(id==='companion-mouth')this.mouth=o;if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});
  let face:T.Object3D|undefined;model.traverse(o=>{if(o.userData.moonId==='companion-face')face=o;});
  if(face instanceof T.Mesh&&typeof document!=='undefined'&&typeof document.createElement==='function'){this.face=new CompanionFace();const m=face.material as T.MeshStandardMaterial;const old=m.map;m.map=m.emissiveMap=this.face.texture;m.emissive.set(0xffffff);m.emissiveIntensity=.9;m.needsUpdate=true;old?.dispose();}
  batchMoonStatics(model);
  this.plume=new T.Mesh(new T.ConeGeometry(.038,.15,24),new T.MeshBasicMaterial({color:0x54caff,transparent:true,opacity:.36,depthWrite:false,blending:T.AdditiveBlending}));this.plume.rotation.x=Math.PI;this.plume.position.y=-.47;this.floating.add(this.plume);
 }
 update(dt:number,mood:CompanionMood='idle',player?:T.Vector3,obstacles:ReadonlyArray<{x:number;z:number;hx:number;hz:number}>=[]){
  const delta=Number.isFinite(dt)?Math.min(.05,Math.max(0,dt)):0;this.time+=delta;const t=this.time;this.face?.draw(t,mood);
  const p=this.root.position,[tx,tz]=this.route[this.waypoint],dx=tx-p.x,dz=tz-p.z,distance=Math.hypot(dx,dz);
  const nearPlayer=!!player&&Math.abs(player.y-p.y)<1.2&&Math.hypot(player.x-p.x,player.z-p.z)<1;
  if(this.rest>0)this.rest=Math.max(0,this.rest-delta);
  else if(!nearPlayer&&mood==='idle'){
   if(distance<.04){this.waypoint=(this.waypoint+1)%this.route.length;this.rest=2.5;}
   else{const step=Math.min(distance,.23*delta),x=p.x+dx/distance*step,z=p.z+dz/distance*step;
    const safe=x>=-1&&x<=1&&z>=-28.8&&z<=-8.6&&!obstacles.some(o=>Math.abs(x-o.x)<o.hx+.38&&Math.abs(z-o.z)<o.hz+.38);
    if(safe){p.x=x;p.z=z;}else{this.rest=1.5;this.waypoint=(this.waypoint+1)%this.route.length;}
   }
  }
  const watching=player&&Math.abs(player.x)<3.85&&player.z<-8&&player.z>-32&&Math.hypot(player.x-p.x,player.z-p.z)<3.5;
  const heading=watching?Math.atan2(player.x-p.x,player.z-p.z):Math.atan2(dx,dz);
  const turn=Math.atan2(Math.sin(heading-this.root.rotation.y),Math.cos(heading-this.root.rotation.y));this.root.rotation.y+=turn*(1-Math.exp(-delta*2.5));
  this.floating.position.y=Math.sin(t*1.7)*.012;this.floating.rotation.z=Math.sin(t*.85)*.016;
  const blinkPhase=t%5.5,blink=blinkPhase<.18?Math.max(.10,Math.abs(blinkPhase-.09)/.09):1;
  this.eyes.forEach((eye,i)=>{eye.scale.y=blink*(mood==='thinking'?.6+.3*Math.sin(t*4+i*2):1);});
  if(this.mouth)this.mouth.scale.y=mood==='listening'?.85+.16*Math.sin(t*3):1;
  this.arms.forEach(({object,rest},i)=>{object.quaternion.copy(rest);object.rotateY(Math.sin(t*1.2+i*2)*.045);});
  this.plume.scale.y=.95+.07*Math.sin(t*9);
 }
}
