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
  camera.position.copy(this.position).add(new T.Vector3(0,2,0));camera.layers.set(1);camera.fov=64;camera.lookAt(0,2700,-5600);camera.updateProjectionMatrix();
  const panel=document.createElement('div');this.panel=panel;panel.className='moon-scope-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','天文望远镜');panel.setAttribute('aria-modal','true');panel.tabIndex=-1;
  panel.innerHTML='<div class="scope-lens-rim" aria-hidden="true"></div><div class="scope-glass" aria-hidden="true"></div><img class="scope-optic-marks" src="/moon/content/ui/eyepiece-reticle.svg" alt="" aria-hidden="true"/><header class="scope-header"><small>SELENE / OPTICAL UNIT</small><h2>星空总览</h2><p class="scope-detail">选择星体，开始观测。</p><small>示意星空 · 非实时天象</small></header><div class="scope-optical-reading"><output></output><span class="scope-target-name">星空总览</span></div><details class="scope-catalog"><summary>观测目标 <span>＋</span></summary><div class="scope-targets"></div></details><div class="scope-bottom"><p>拖动瞄准 · 滚轮调节倍率</p><div class="scope-buttons"></div></div>';
  host.appendChild(panel);panel.focus({preventScroll:true});
  const buttons=panel.querySelector('.scope-buttons')!,targets=panel.querySelector('.scope-targets')!;
  const catalog=panel.querySelector<HTMLDetailsElement>('.scope-catalog')!;
  let target:typeof observationTargets[number]|null=null;
  const refresh=()=>{const power=(Math.tan(T.MathUtils.degToRad(32))/Math.tan(T.MathUtils.degToRad(camera.fov/2))).toFixed(1);panel.querySelector('output')!.textContent=power+'× / '+camera.fov.toFixed(1)+'°';};
  const zoom=(f:number)=>{camera.fov=T.MathUtils.clamp(f,2,64);camera.updateProjectionMatrix();refresh();};
  const updateSelection=()=>{targets.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.target===(target?.name??'overview'))));};
  const overview=()=>{target=null;camera.lookAt(0,2700,-5600);panel.querySelector('h2')!.textContent='星空总览';panel.querySelector('.scope-detail')!.textContent='地球、火星、木星与土星';panel.querySelector('.scope-target-name')!.textContent='星空总览';zoom(64);updateSelection();};
  const button=(label:string,fn:()=>void,parent:Element=buttons)=>{const b=document.createElement('button');b.textContent=label;b.type='button';b.onclick=fn;parent.appendChild(b);return b;};
  button('重新对准',()=>{if(target)camera.lookAt(target.position);else camera.lookAt(0,2700,-5600);});
  button('−',()=>zoom(camera.fov*1.25)).setAttribute('aria-label','缩小倍率');button('+',()=>zoom(camera.fov/1.25)).setAttribute('aria-label','放大倍率');
  button('复位倍率',()=>zoom(target?.fov??64));const leave=button('Esc 退出观测',onExit);leave.className='scope-exit';
  const wide=button('星空总览',()=>{overview();catalog.open=false;},targets);wide.dataset.target='overview';
  for(const entry of observationTargets){const b=button(entry.name,()=>{target=entry;panel.querySelector('h2')!.textContent=entry.name;panel.querySelector('.scope-detail')!.textContent=entry.detail;panel.querySelector('.scope-target-name')!.textContent=entry.name;camera.lookAt(entry.position);zoom(entry.fov);updateSelection();catalog.open=false;},targets);b.dataset.target=entry.name;}
  updateSelection();refresh();
  this.abort=new AbortController();const signal=this.abort.signal;let dragging=false;
  host.addEventListener('pointerdown',e=>{if((e.target as HTMLElement).closest('button,summary,details'))return;dragging=true;},{signal});window.addEventListener('pointerup',()=>dragging=false,{signal});window.addEventListener('blur',()=>dragging=false,{signal});
  window.addEventListener('pointermove',e=>{if(!dragging)return;const rot=new T.Euler().setFromQuaternion(camera.quaternion,'YXZ');const rate=.0015*camera.fov/24;rot.y-=e.movementX*rate;rot.x=T.MathUtils.clamp(rot.x-e.movementY*rate,-1.5,1.5);camera.quaternion.setFromEuler(rot);},{signal});
  host.addEventListener('wheel',e=>{e.preventDefault();zoom(camera.fov*Math.exp(T.MathUtils.clamp(e.deltaY,-120,120)*.002));},{signal,passive:false});
  document.addEventListener('keydown',e=>{e.stopImmediatePropagation();if(e.code==='Escape'){e.preventDefault();onExit();}else if(e.key==='Tab'){const items=Array.from(panel.querySelectorAll<HTMLElement>('button,summary')).filter(el=>el.getClientRects().length>0),index=items.indexOf(document.activeElement as HTMLElement);if(items.length){e.preventDefault();items[(index+(e.shiftKey?-1:1)+items.length)%items.length].focus();}}else if(e.code==='Equal'||e.code==='NumpadAdd'){e.preventDefault();zoom(camera.fov/1.25);}else if(e.code==='Minus'||e.code==='NumpadSubtract'){e.preventDefault();zoom(camera.fov*1.25);}},{signal,capture:true});
 }
 exit(camera:T.PerspectiveCamera){if(!this.saved)return;camera.position.copy(this.saved.position);camera.quaternion.copy(this.saved.quaternion);camera.fov=this.saved.fov;camera.layers.mask=this.saved.layers;camera.updateProjectionMatrix();this.saved=null;this.abort?.abort();this.panel?.remove();this.panel=null;}
 dispose(camera:T.PerspectiveCamera){this.exit(camera);}
}
