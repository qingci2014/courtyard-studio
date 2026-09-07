import {observationTargets} from './moon-observation';
import * as T from 'three';
import {groundHeight} from './moon-terrain';

export const EARTH_POSITION=observationTargets[0].position;
/** A fixed optical station. Targets can later share this same viewing system. */
export class MoonTelescope {
 readonly root=new T.Group();
 readonly position=new T.Vector3(8,groundHeight(8,12),12);
 private panel:HTMLDivElement|null=null;
 private abort:AbortController|null=null;
 private saved:{position:T.Vector3;quaternion:T.Quaternion;fov:number;layers:number}|null=null;
 constructor(){
  this.root.position.copy(this.position);
  const white=new T.MeshStandardMaterial({color:0xc9ced1,metalness:.65,roughness:.34});
  const dark=new T.MeshStandardMaterial({color:0x242d32,metalness:.72,roughness:.38});
  const glass=new T.MeshStandardMaterial({color:0x163c50,metalness:.7,roughness:.12});
  const rod=(a:T.Vector3,b:T.Vector3,r:number,mat:T.Material)=>{const mesh=new T.Mesh(new T.CylinderGeometry(r,r,a.distanceTo(b),32),mat);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());mesh.castShadow=true;mesh.receiveShadow=true;this.root.add(mesh);return mesh;};
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3;const x=Math.cos(a)*.7,z=Math.sin(a)*.7,y=groundHeight(8+x,12+z)-this.position.y;rod(new T.Vector3(x,y+.035,z),new T.Vector3(0,1.1,0),.046,dark);rod(new T.Vector3(x,y,z),new T.Vector3(x,y+.06,z),.13,white);}
  rod(new T.Vector3(0,.75,0),new T.Vector3(0,1.5,0),.13,white);
  rod(new T.Vector3(-.32,1.48,0),new T.Vector3(.32,1.48,0),.10,dark);
  const aim=EARTH_POSITION.clone().sub(this.position).normalize(),center=new T.Vector3(0,1.72,0);
  rod(center.clone().addScaledVector(aim,-.52),center.clone().addScaledVector(aim,.64),.23,white);
  for(const t of [-.49,-.18,.34,.63])rod(center.clone().addScaledVector(aim,t-.025),center.clone().addScaledVector(aim,t+.025),.246,dark);
  rod(center.clone().addScaledVector(aim,.65),center.clone().addScaledVector(aim,.66),.21,glass);
  rod(center.clone().addScaledVector(aim,-.73),center.clone().addScaledVector(aim,-.52),.065,dark);
  const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d')!;ctx.fillStyle='#12232c';ctx.fillRect(0,0,512,128);ctx.fillStyle='#bce9f8';ctx.font='bold 32px sans-serif';ctx.textAlign='center';ctx.fillText('天文观测站',256,52);ctx.font='22px sans-serif';ctx.fillText('EARTH OBSERVATORY · E',256,96);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;const sign=new T.Mesh(new T.PlaneGeometry(.9,.225),new T.MeshBasicMaterial({map:tex,side:T.DoubleSide}));sign.position.set(0,.95,.24);this.root.add(sign);
 }
 get active(){return !!this.saved;}
 enter(camera:T.PerspectiveCamera,host:HTMLElement,onExit:()=>void){
  if(this.active)return;
  this.saved={position:camera.position.clone(),quaternion:camera.quaternion.clone(),fov:camera.fov,layers:camera.layers.mask};
  camera.position.copy(this.position).add(new T.Vector3(0,2,0));camera.layers.set(1);camera.fov=12;camera.lookAt(EARTH_POSITION);camera.updateProjectionMatrix();
  const panel=document.createElement('div');this.panel=panel;panel.style.cssText='position:fixed;inset:0;z-index:100;background:radial-gradient(circle at center,transparent 0,transparent 28vmin,rgba(0,0,0,.18) 33vmin,rgba(0,0,0,.7) 37vmin,#000 38vmin);color:#c7ebf5;pointer-events:none;font:14px sans-serif';
  panel.innerHTML='<style>.moon-app:has(.scope-buttons)>:not(.moon-scene){visibility:hidden}</style><div style="position:absolute;left:50%;top:50%;width:76vmin;height:76vmin;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(ellipse at 30% 8%,rgba(145,200,220,.055),transparent 45%),radial-gradient(circle,transparent 72%,rgba(70,150,170,.06) 88%,transparent 99%);box-shadow:0 0 0 2px #161b1d,0 0 0 8px #080a0b,inset 0 0 24px #000"></div><div style="position:absolute;top:24px;left:28px;max-width:260px;font-size:12px"><small>SELENE / OPTICAL OBSERVATORY</small><h2>地球 · EARTH</h2><p class="scope-detail">目镜观测 · 海洋、陆地与云层</p><small>示意星空 · 非实时天象</small><output style="display:block;margin-top:12px"></output></div><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:60px;height:60px;opacity:.38"><i style="position:absolute;left:0;top:29px;width:60px;height:1px;background:linear-gradient(to right,#bcd4d5 0 42%,transparent 42% 58%,#bcd4d5 58%)"></i><i style="position:absolute;left:29px;top:0;width:1px;height:60px;background:linear-gradient(to bottom,#bcd4d5 0 42%,transparent 42% 58%,#bcd4d5 58%)"></i><i style="position:absolute;inset:16px;border:1px solid #9bbabc;border-radius:50%;opacity:.35"></i></div><div style="position:absolute;bottom:16px;left:0;right:0;text-align:center;pointer-events:auto"><p>按住画面拖动瞄准 · 滚轮调节倍率 · Esc 退出</p><div class="scope-buttons"></div></div>';
  host.appendChild(panel);const buttons=panel.querySelector('.scope-buttons')!;
  let target:typeof observationTargets[number]=observationTargets[0];
  const refresh=()=>{panel.querySelector('output')!.textContent=`光学倍率 ${(Math.tan(T.MathUtils.degToRad(64/2))/Math.tan(T.MathUtils.degToRad(camera.fov/2))).toFixed(1)}×  /  视场 ${camera.fov.toFixed(1)}°`;};
  const zoom=(f:number)=>{camera.fov=T.MathUtils.clamp(f,2,64);camera.updateProjectionMatrix();refresh();};
  const button=(label:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=label;b.style.cssText='margin:4px;padding:11px 18px;color:#d7f5ff;background:#142b36;border:1px solid #537080;border-radius:6px;cursor:pointer';b.onclick=fn;buttons.appendChild(b);};
  button('对准目标',()=>{camera.lookAt(target.position);panel.querySelector('h2')!.textContent=target.name;panel.querySelector('.scope-detail')!.textContent=target.detail;});button('−',()=>zoom(camera.fov*1.25));button('+',()=>zoom(camera.fov/1.25));button('复位倍率',()=>zoom(target.fov));button('退出观测',onExit);for(const entry of observationTargets)button(entry.name,()=>{target=entry;panel.querySelector('h2')!.textContent=target.name;panel.querySelector('.scope-detail')!.textContent=target.detail;camera.lookAt(target.position);zoom(target.fov);});button('星空总览',()=>{camera.lookAt(0,2700,-5600);panel.querySelector('h2')!.textContent='星空总览';panel.querySelector('.scope-detail')!.textContent='地球、火星、木星与土星 · 选择目标放大观察';zoom(64);});refresh();
  this.abort=new AbortController();const signal=this.abort.signal;let dragging=false;
  host.addEventListener('pointerdown',e=>{if((e.target as HTMLElement).closest('button'))return;dragging=true;},{signal});window.addEventListener('pointerup',()=>dragging=false,{signal});window.addEventListener('blur',()=>dragging=false,{signal});
  window.addEventListener('pointermove',e=>{if(!dragging)return;const rot=new T.Euler().setFromQuaternion(camera.quaternion,'YXZ');const rate=.0015*camera.fov/24;rot.y-=e.movementX*rate;rot.x=T.MathUtils.clamp(rot.x-e.movementY*rate,-1.5,1.5);camera.quaternion.setFromEuler(rot);},{signal});
  host.addEventListener('wheel',e=>{e.preventDefault();zoom(camera.fov*Math.exp(T.MathUtils.clamp(e.deltaY,-120,120)*.002));},{signal,passive:false});
  document.addEventListener('keydown',e=>{e.stopImmediatePropagation();if(e.code==='Escape'){e.preventDefault();onExit();}},{signal,capture:true});
 }
 exit(camera:T.PerspectiveCamera){if(!this.saved)return;camera.position.copy(this.saved.position);camera.quaternion.copy(this.saved.quaternion);camera.fov=this.saved.fov;camera.layers.mask=this.saved.layers;camera.updateProjectionMatrix();this.saved=null;this.abort?.abort();this.panel?.remove();this.panel=null;}
 dispose(camera:T.PerspectiveCamera){this.exit(camera);}
}
