import * as THREE from 'three';
import * as M from './model.js';
import * as E from './editing.js';
import {openingDragPatch,updateOpening} from './openings.js';
import {projectedDragDelta} from './modeling.js';

export function installOpeningViewer(v){
 let mode='move',selectedId='',drag=null,outline=null,outlineKey='';
 const bar=document.createElement('div');bar.className='opening-gizmo-bar pull-measure';bar.hidden=true;bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','门窗构件工具');
 bar.innerHTML='<button class="btn small" data-opening-mode="move" title="M：沿所属墙移动，洞口同步移动">移动</button><button class="btn small" data-opening-mode="scale" title="S：拖边柄改宽高，拖角柄等比缩放；Ctrl 从中心改宽度">缩放</button><button class="btn small" data-opening-flip="hinge" title="沿门宽方向翻转，交换铰链边">左右翻转</button><button class="btn small" data-opening-flip="swing" title="沿墙的法线方向翻转，改变开启侧">内外翻转</button><span class="opening-size"></span><span class="pull-result" role="status"></span>';
 v.host.append(bar);const status=bar.querySelector('.pull-result'),size=bar.querySelector('.opening-size');
 const labels={move:'沿墙移动门窗',left:'缩放左边',right:'缩放右边',top:'缩放高度','corner-left':'左上角等比缩放','corner-right':'右上角等比缩放'},grips={};
 for(const [handle,label] of Object.entries(labels)){const b=document.createElement('button');b.className='opening-gizmo-grip'+(handle==='move'?' opening-move-grip':'');b.dataset.openingHandle=handle;b.title=label;b.setAttribute('aria-label',label);b.hidden=true;if(handle==='move')b.textContent='✥';v.host.append(b);grips[handle]=b;}
 const active=()=>{if(!v.project||v.walk||v.animationStart||v.interactionTool!=='select'||v.selected?.length!==1)return null;const ref=v.selected[0],floor=v.project.floors.find(f=>f.id===ref.floorId);if(ref.kind!=='opening'||!floor||E.hidden(floor,ref)||E.locked(floor,ref)||v.options.floor!=='all'&&v.options.floor!==floor.id)return null;const o=E.entity(floor,ref),w=floor.walls.find(w=>w.id===o.wallId),i=v.project.floors.indexOf(floor),p=M.onWall(w,o.offset),base=M.floorElevation(v.project,i)+(v.options.exploded?i*2.3:0);return {ref,floor,o,w,u:new THREE.Vector3(w.b.x-w.a.x,0,w.b.y-w.a.y).normalize(),origin:new THREE.Vector3(p.x,base+(o.sill||0),p.y)};};
 const pixel=p=>{const q=p.clone().project(v.camera);return {x:(q.x+1)*v.host.clientWidth/2,y:(1-q.y)*v.host.clientHeight/2,z:q.z};};
 const at=(t,x,y)=>t.origin.clone().addScaledVector(t.u,x).add(new THREE.Vector3(0,y,0));
 const clearOutline=()=>{if(outline){v.scene.remove(outline);outline.geometry.dispose();outline.material.dispose();outline=null;}v.openingOutline=null;outlineKey='';};
 v.updateOpeningHandles=()=>{
  const t=active();if(!t){if(drag)end(true);bar.hidden=true;Object.values(grips).forEach(b=>b.hidden=true);clearOutline();selectedId='';return;}
  if(selectedId!==t.ref.id){selectedId=t.ref.id;mode='move';status.textContent='';}
  bar.hidden=false;bar.querySelectorAll('[data-opening-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.openingMode===mode);b.setAttribute('aria-pressed',String(b.dataset.openingMode===mode));});bar.querySelectorAll('[data-opening-flip]').forEach(b=>b.hidden=t.o.type!=='door');size.textContent=t.o.width.toFixed(2)+' × '+t.o.height.toFixed(2)+' m';
  const points={move:[0,t.o.height/2],left:[-t.o.width/2,t.o.height/2],right:[t.o.width/2,t.o.height/2],top:[0,t.o.height],'corner-left':[-t.o.width/2,t.o.height],'corner-right':[t.o.width/2,t.o.height]};
  for(const [handle,b] of Object.entries(grips)){const p=at(t,...points[handle]),q=pixel(p);b.hidden=(mode==='move')!==(handle==='move')||q.z<-1||q.z>1||q.x<0||q.y<0||q.x>v.host.clientWidth||q.y>v.host.clientHeight||!!(v.sectionPlane&&v.sectionPlane.distanceToPoint(p)<0);if(!b.hidden){b.style.left=q.x+'px';b.style.top=q.y+'px';}}
  const key=JSON.stringify([t.ref.id,t.origin.toArray(),t.u.toArray(),t.o.width,t.o.height,mode]);if(key!==outlineKey){clearOutline();if(mode==='scale'){const p=[at(t,-t.o.width/2,0),at(t,t.o.width/2,0),at(t,t.o.width/2,t.o.height),at(t,-t.o.width/2,t.o.height)];outline=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(p),new THREE.LineBasicMaterial({color:'#d98259',depthTest:false}));outline.renderOrder=4;v.scene.add(outline);v.openingOutline=outline;}outlineKey=key;}
 };
 function start(e,handle){
  if(e.button!==0)return;const t=active();if(!t||v.onOpeningEdit?.('start',t.ref)===false)return;e.preventDefault();e.stopPropagation();
  const sign=handle.endsWith('left')?-1:1,axis=handle==='move'?t.u.clone():handle==='top'?new THREE.Vector3(0,1,0):handle.startsWith('corner')?t.u.clone().multiplyScalar(sign*t.o.width).add(new THREE.Vector3(0,t.o.height,0)):t.u.clone().multiplyScalar(sign);
  const p=at(t,handle==='top'||handle==='move'?0:sign*t.o.width/2,handle==='move'||!handle.startsWith('corner')&&handle!=='top'?t.o.height/2:t.o.height),a=pixel(p),b=pixel(p.clone().add(axis));let dx=b.x-a.x,dy=b.y-a.y;if(Math.hypot(dx,dy)<8){dx=0;dy=-40;}
  drag={ref:t.ref,original:M.clone(t.o),handle,x:e.clientX,y:e.clientY,dx,dy,button:e.currentTarget,pointerId:e.pointerId,orbit:v.orbit.enabled,delta:null};v.orbit.enabled=false;status.textContent='';e.currentTarget.setPointerCapture(e.pointerId);
 }
 const move=e=>{if(!drag||drag.pointerId!==e.pointerId)return;e.preventDefault();const d=drag;if(Math.hypot(e.clientX-d.x,e.clientY-d.y)<3&&d.delta===null)return;let delta=projectedDragDelta(e.clientX-d.x,e.clientY-d.y,d.dx,d.dy);delta=Math.round(delta*1000)/1000;if(delta===d.delta)return;
  const patch=openingDragPatch(d.original,d.handle,delta,{center:e.ctrlKey||e.metaKey}),response=v.onOpeningEdit?.('preview',d.ref,patch);if(response?.ok){d.delta=delta;status.textContent='';}else status.textContent=response?.error||'无法放置这个尺寸';
 };
 function end(cancel=false){if(!drag)return;const d=drag;drag=null;v.orbit.enabled=d.orbit;if(d.button.hasPointerCapture(d.pointerId))d.button.releasePointerCapture(d.pointerId);v.onOpeningEdit?.(cancel?'cancel':'commit',d.ref);if(cancel)status.textContent='已取消本次操作';}
 for(const [handle,b] of Object.entries(grips)){b.addEventListener('pointerdown',e=>start(e,handle));b.addEventListener('pointermove',move);b.addEventListener('pointerup',()=>end(false));b.addEventListener('pointercancel',()=>end(true));b.addEventListener('lostpointercapture',()=>end(true));b.onclick=e=>e.stopPropagation();}
 bar.onpointerdown=e=>e.stopPropagation();bar.onclick=e=>{const b=e.target.closest('button'),t=active();if(!b||!t)return;if(b.dataset.openingMode){mode=b.dataset.openingMode;status.textContent='';v.updateOpeningHandles();}else if(b.dataset.openingFlip&&v.onOpeningEdit?.('start',t.ref)!==false){const key=b.dataset.openingFlip,response=v.onOpeningEdit?.('preview',t.ref,{[key]:-(t.o[key]||1)});v.onOpeningEdit?.(response?.ok?'commit':'cancel',t.ref);if(!response?.ok)status.textContent=response?.error||'无法翻转';}};
 document.addEventListener('keydown',e=>{if(drag){if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();end(true);}else if((e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())){e.preventDefault();e.stopImmediatePropagation();}return;}if(!active()||e.target.closest('input,textarea,select,[contenteditable]')||document.querySelector('dialog[open]')||e.ctrlKey||e.metaKey||e.altKey)return;const key=e.key.toLowerCase();if(['m','s'].includes(key)){e.preventDefault();e.stopImmediatePropagation();mode=key==='s'?'scale':'move';v.updateOpeningHandles();}},true);
 window.addEventListener('blur',()=>end(true));document.addEventListener('visibilitychange',()=>{if(document.hidden)end(true);});v.cancelOpeningEdit=()=>end(true);
}

export function connectOpeningEditor(viewer,{getProject,setProject,history,changed,render,toast}){
 if(!viewer)return;let before=null;
 viewer.onOpeningEdit=(stage,ref,patch)=>{
  if(stage==='start'){try{E.assertEditable(getProject().floors.find(f=>f.id===ref.floorId),[ref]);before=M.clone(getProject());return true;}catch(e){toast(e.message);return false;}}
  if(!before)return {ok:false,error:'请重新选择门窗'};
  if(stage==='preview'){try{const next=M.clone(before),floor=next.floors.find(f=>f.id===ref.floorId);updateOpening(floor,ref.id,patch);E.assertLocksPreserved(before,next);setProject(M.validateProject(next));render();return {ok:true};}catch(e){return {ok:false,error:e.message};}}
  const initial=before;before=null;if(stage==='cancel')setProject(initial);else if(JSON.stringify(initial)!==JSON.stringify(getProject())){history(initial);changed();}render();return {ok:true};
 };
}
