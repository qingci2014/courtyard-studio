import * as T from 'three';
import {batchMoonStatics} from './moon-batching';
import type {MoonState} from './moon-mission';
import layout from '../public/content/bedroom-layout.json';

type Obstacle={id:string;x:number;z:number;hx:number;hz:number};

/** The connecting passage needs indoor finishes, independent of the exterior shell. */
export function prepareBedroomPassage(base:T.Group){
 const finishes=new Map<string,T.MeshStandardMaterial>();
 base.traverse(o=>{
  if(!(o instanceof T.Mesh)||!(o.material instanceof T.MeshStandardMaterial))return;
  const name=o.name.replace(/_/g,' '),floor=/^Passage floor(?:\.\d+)?$/.test(name);
  if(!floor&&!/^Passage (?:wall|roof)(?:\.\d+)?$/.test(name))return;
  const kind=floor?'floor':'lining';let material=finishes.get(kind);
  if(!material){
   material=o.material.clone();material.name='Passage indoor '+kind;
   material.color.setRGB(...(floor?[.22,.235,.235]:[.43,.435,.42]) as [number,number,number]);
   material.metalness=floor?.12:0;material.roughness=floor?.82:.72;material.envMapIntensity=.18;
   finishes.set(kind,material);
  }
  o.material=material;
 });
}

const oldFurniture=new Set(['berth','locker','table','living-stool','cabin-workdesk','cabin-workchair','cabin-archive']);
const oldNames=/^(?:Sleep |Berth |Personal locker|Locker |Dining |Living (?:ceiling light|stool seat|skirting|floor guide|floor joint)|Stool leg|Crew quarters plaque|Cabin |Realism |Holo desk |Label )/;

/** Remove only the old bedroom insert; shell, other rooms and ship remain intact. */
export function replaceBedroomInterior(base:T.Group,obstacles:Obstacle[]){
 base.updateMatrixWorld(true);
 const removed:T.Mesh[]=[];
 base.traverse(o=>{
  if(!(o instanceof T.Mesh)||!oldNames.test(o.name.replace(/_/g,' '))||o.userData.moonId)return;
  const center=new T.Box3().setFromObject(o).getCenter(new T.Vector3());
  // Some authored cloth vertices are in world coordinates, so object.position is not sufficient.
  if(center.z<-21.75&&center.z>-32.20&&Math.abs(center.x)<4.2)removed.push(o);
 });
 for(const o of removed)o.removeFromParent();
 const retained=new Set<T.BufferGeometry>();base.traverse(o=>{if(o instanceof T.Mesh)retained.add(o.geometry);});
 for(const geometry of new Set(removed.map(o=>o.geometry)))if(!retained.has(geometry))geometry.dispose();
 return [...obstacles.filter(o=>!(oldFurniture.has(o.id)&&o.z<-21.75&&o.z>-32.2)),...layout.colliders];
}

/** Authored GLB insert plus the two low-brightness, live environmental displays. */
export class MoonBedroom{
 readonly root:T.Group;readonly lights:T.PointLight[]=[];
 private bakedMaterials:T.MeshStandardMaterial[]=[];private lightingStrength=0;
 private reflections?:T.WebGLRenderTarget;
 private emissives:{material:T.MeshStandardMaterial;strength:number}[]=[];
 private screens:{canvas:HTMLCanvasElement;texture:T.CanvasTexture;material:T.MeshStandardMaterial;kind:'main'|'status'|'desk'}[]=[];
 private signature='';private elapsed=0;
 constructor(model:T.Group,lighting?:{texture:T.Texture;gain:number}){
  this.root=model;this.root.name='Warm crew habitat';
  if(lighting){
   lighting.texture.colorSpace=T.SRGBColorSpace;lighting.texture.flipY=false;lighting.texture.channel=1;lighting.texture.anisotropy=4;
   // Cycles diffuse bake stores outgoing radiance; Three's Lambert term divides by pi.
   this.lightingStrength=lighting.gain*Math.PI;
  }
  const seen=new Set<T.Material>();
  model.traverse(o=>{
   if(!(o instanceof T.Mesh))return;
   o.castShadow=!o.userData.surfaceLabel;o.receiveShadow=!o.userData.surfaceLabel;
   for(const m of Array.isArray(o.material)?o.material:[o.material]){
    if(seen.has(m))continue;seen.add(m);
    if(m instanceof T.MeshStandardMaterial){
     if(lighting){
      m.lightMap=lighting.texture;m.lightMapIntensity=0;m.envMapIntensity=.12;this.bakedMaterials.push(m);
      // The atlas already contains the static diffuse and soft contact shadows.
      // Prevent the exterior sun/room ambience from being counted a second time.
      m.onBeforeCompile=shader=>{
       shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_maps>','irradiance = vec3(0.0);\n#include <lights_fragment_maps>');
       shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>','iblIrradiance = vec3(0.0);\n#include <lights_fragment_end>\nreflectedLight.directDiffuse = vec3(0.0);\nreflectedLight.directSpecular = vec3(0.0);');
      };
      m.customProgramCacheKey=()=> 'habitat-cycles-irradiance-v1';
     }
     if(m.name.includes('photo textile')){m.alphaTest=.5;m.transparent=false;m.depthWrite=true;m.side=T.DoubleSide;}
     if(m.emissiveIntensity>0&&!m.emissive.equals(new T.Color(0))){m.userData.bedroomBloom=true;this.emissives.push({material:m,strength:m.emissiveIntensity});}
     for(const key of ['map','normalMap','roughnessMap'] as const)if(m[key])m[key]!.anisotropy=4;
    }
   }
  });
  batchMoonStatics(model);
  // Opaque backing keeps the original pressure shell from shining through panel joints.
  const ceilingBacking=new T.Mesh(new T.PlaneGeometry(7.68,9.98),new T.MeshBasicMaterial({color:0x101414,side:T.DoubleSide}));
  ceilingBacking.name='Bedroom ceiling seam backing';ceilingBacking.rotation.x=Math.PI/2;ceilingBacking.position.set(0,3.503,-27);ceilingBacking.castShadow=true;model.add(ceilingBacking);
  this.screen('main',2.20,1.27,[3.499,2.15,-29.16]);
  this.screen('status',.326,.875,[3.566,2.18,-27.27]);
  this.screen('desk',1.27,3.13,[2.99,1.044,-29.12],true);
  // Restrained warm illumination under the ceiling and within the recesses.
  for(const [x,y,z,power,range] of [
   [0,3.12,-28.7,21,7],[-2.8,2.8,-30.45,6,3.6],[2.7,2.9,-29.1,8,3.9],
   [-.64,1.46,-30.9,.65,1.7],[-3.05,2.25,-24.9,4,3],[3.04,2.85,-25.8,2.4,2.2]
  ]){
   const light=new T.PointLight(0xffdfad,0,range,2);light.position.set(x,y,z);light.userData.nominalIntensity=power;
   // The main soft source supplies local contact shadows; small niche fills stay inexpensive.
   if(this.lights.length===0){light.castShadow=true;light.shadow.mapSize.set(512,512);light.shadow.camera.near=.08;light.shadow.normalBias=.009;light.shadow.bias=-.00005;light.shadow.autoUpdate=false;light.shadow.needsUpdate=true;}
   this.lights.push(light);model.add(light);
  }
 }
 /** Capture the room's own lights and surfaces instead of generic studio windows. */
 prepareReflections(renderer:T.WebGLRenderer,pmrem:T.PMREMGenerator){
  if(!this.bakedMaterials.length)return;
  this.reflections?.dispose();this.reflections=undefined;
  for(const material of this.bakedMaterials){material.envMap=null;material.lightMapIntensity=this.lightingStrength;material.needsUpdate=true;}
  for(const {material,strength} of this.emissives)material.emissiveIntensity=strength;
  const scene=new T.Scene();scene.background=new T.Color(0x080808);const capture=this.root.clone(true);
  capture.traverse(o=>{if(o instanceof T.Light)o.visible=false;});scene.add(capture);scene.updateMatrixWorld(true);
  const target=new T.WebGLCubeRenderTarget(128,{type:T.HalfFloatType});const camera=new T.CubeCamera(.08,45,target);camera.position.set(0,1.7,-27.5);
  try{
   camera.update(renderer,scene);this.reflections=pmrem.fromCubemap(target.texture);
   for(const material of this.bakedMaterials){material.envMap=this.reflections.texture;material.envMapIntensity=material.metalness>.5?.72:.32;material.needsUpdate=true;}
   for(const screen of this.screens){screen.material.envMap=this.reflections.texture;screen.material.envMapIntensity=.18;screen.material.needsUpdate=true;}
  }finally{target.dispose();this.signature='';}
 }
 dispose(){this.reflections?.dispose();this.reflections=undefined;}
 private screen(kind:'main'|'status'|'desk',width:number,height:number,position:[number,number,number],horizontal=false){
  const canvas=document.createElement('canvas');canvas.width=kind==='status'?320:1280;canvas.height=kind==='status'?840:kind==='desk'?1024:740;
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
  const material=new T.MeshStandardMaterial({map:texture,emissiveMap:texture,emissive:0xffffff,emissiveIntensity:.55,roughness:.52,metalness:.04});
  material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>','#include <lights_fragment_end>\nreflectedLight.directDiffuse = vec3(0.0);\nreflectedLight.directSpecular = vec3(0.0);\nreflectedLight.indirectDiffuse = vec3(0.0);');};
  material.customProgramCacheKey=()=> 'habitat-live-display-v1';
  const plane=new T.Mesh(new T.PlaneGeometry(width,height),material);plane.name='Bedroom live '+kind+' display';plane.userData.moonId='bedroom-screen-'+kind;plane.position.set(...position);
  if(horizontal)plane.rotation.x=-Math.PI/2;else plane.rotation.y=-Math.PI/2;
  this.root.add(plane);this.screens.push({canvas,texture,material,kind});
 }
 update(dt:number,state:MoonState){
  this.elapsed+=dt;const signature=[state.powered,state.solarRepaired,state.waterOnline,state.commsOnline,Math.floor(this.elapsed/30)].join(':');
  if(signature===this.signature)return;this.signature=signature;
  for(const material of this.bakedMaterials){material.lightMapIntensity=state.powered?this.lightingStrength:.012;material.envMapIntensity=state.powered?(material.metalness>.5?.72:.32):.005;}
  for(const e of this.emissives)e.material.emissiveIntensity=state.powered?e.strength:0;
  for(const screen of this.screens){
   const {canvas,texture,material,kind}=screen;const c=canvas.getContext('2d')!;const w=canvas.width,h=canvas.height;
   c.fillStyle='#071015';c.fillRect(0,0,w,h);material.emissiveIntensity=state.powered?.55:0;material.envMapIntensity=state.powered?.18:.001;
   if(!state.powered){texture.needsUpdate=true;continue;}
   const label=(s:string,x:number,y:number,size=22,color='#819aa3')=>{c.fillStyle=color;c.font=`${size}px "Segoe UI",sans-serif`;c.fillText(s,x,y);};
   const line=(x:number,y:number,xx:number,yy:number,color='#253b43')=>{c.strokeStyle=color;c.lineWidth=1;c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.stroke();};
   if(kind==='main'){
    label('SELENE  /  HABITAT 01',54,70,24,'#adbec1');label('船员生活舱',54,146,49,'#d3dcdb');
    label('REST. RECHARGE. EXPLORE.',56,195,19);line(54,224,w-54,224);
    // The habitat diagram is intentionally subdued, like a bonded instrument display.
    const cx=930,cy=419;
    for(const r of [103,136,175]){c.strokeStyle=r===103?'#7e989f':'#233d48';c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);c.stroke();}
    const gradient=c.createRadialGradient(cx-38,cy-38,8,cx,cy,94);gradient.addColorStop(0,'#819695');gradient.addColorStop(.7,'#445b62');gradient.addColorStop(1,'#10232d');c.fillStyle=gradient;c.beginPath();c.arc(cx,cy,93,0,Math.PI*2);c.fill();
    for(let i=0;i<13;i++){const a=i*2.4,r=21+(i*19)%64;c.fillStyle=i%2?'#344b52':'#62767a';c.beginPath();c.ellipse(cx+Math.cos(a)*r,cy+Math.sin(a)*r,4+i%9,3+i%7,0,0,Math.PI*2);c.fill();}
    label('LUNA',cx-29,cy+144,17);
    const rows=[['照明与能源',state.solarRepaired?'主电源运行':'应急电源'],['生态循环',state.waterOnline?'循环已上线':'待恢复'],['地球通信',state.commsOnline?'链路已建立':'等待连接']];
    rows.forEach(([name,value],i)=>{const y=311+i*105;label(name,58,y,23);label(value,58,y+43,33,'#c8d5d4');line(58,y+63,657,y+63);});
    label('居住区  /  安静时段',58,681,23,'#8ca7ac');label('LUNAR SURFACE OPERATIONS',826,681,15);
   }else if(kind==='status'){
    label('HABITAT',27,58,23,'#bccbcc');line(27,84,292,84);
    for(const [i,title,value,unit] of [[0,'OXYGEN','21.0','%'],[1,'TEMPERATURE','21.4','°C'],[2,'PRESSURE','101.3','kPa']] as const){
     const y=147+i*190;label(title,27,y,16);label(value,25,y+70,51,'#d6dfdd');label(unit,240,y+70,20);line(27,y+111,292,y+111);
    }
    label(state.waterOnline?'LIFE SUPPORT ONLINE':'RESERVE SUPPORT',27,772,17,'#a0bab4');
   }else{
    label('PERSONAL WORKSPACE',55,72,27,'#92bbc3');line(55,96,w-55,96);
    label('触控输入已连接',55,175,40,'#c6d9dc');
    for(let r=0;r<5;r++)for(let col=0;col<12;col++){const x=62+col*95+(r%2)*8,y=490+r*86;c.strokeStyle='#3d7783';c.lineWidth=2;c.strokeRect(x,y,76,61);label(r===4?'·':String.fromCharCode(65+(r*12+col)%26),x+28,y+39,21,'#659ca7');}
    c.strokeStyle='#335e69';c.strokeRect(69,235,1140,195);label('CABIN SYSTEMS  /  01',94,290,24);label('暖光照明     ·     个人日志     ·     基地状态',94,365,30,'#7da9b2');
   }
   texture.needsUpdate=true;
  }
 }
}
