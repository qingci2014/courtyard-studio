import * as THREE from 'three';
import {floorElevation} from './model.js';
import {entity,locked} from './editing.js';
import {pullFaceInfo,resolvePullFace,samePullFace} from './push-pull.js';
import {projectedDragDelta} from './modeling.js';

export function installPushPullViewer(v){
 const canvas=v.renderer.domElement,ray=new THREE.Raycaster();let chosen=null,drag=null,highlight=null,highlightKey='',highlightRoot=null,lastDelta=0;
 const grip=document.createElement('button');grip.className='model-grip pull-grip';grip.hidden=true;grip.title='沿箭头拖动推拉；Shift 精调；Esc 取消本次拖动';v.host.append(grip);
 const form=document.createElement('form');form.className='pull-measure';form.hidden=true;form.setAttribute('aria-label','三维推拉');
 form.innerHTML='<span class="pull-face-name"></span><label title="正数向外拉，负数向内推；按 Enter 应用"><span>距离 / m</span><input aria-label="推拉距离 / m" type="number" step=".01" min="-100" max="100" value="0"></label><button class="btn small primary" type="submit">应用推拉</button><button class="btn small" type="button" aria-label="结束三维推拉" title="结束推拉，恢复左键旋转">完成</button><span class="pull-result" role="status"></span>';
 v.host.append(form);const number=form.querySelector('input'),name=form.querySelector('.pull-face-name'),result=form.querySelector('.pull-result');
 const pixel=p=>{const q=p.clone().project(v.camera);return {x:(q.x+1)*v.host.clientWidth/2,y:(1-q.y)*v.host.clientHeight/2,z:q.z};};
 const enabled=()=>v.project&&v.options.pushPull&&v.interactionTool==='select'&&!v.walk&&!v.animationStart;
 const selected=()=>{if(!enabled()||v.selected?.length!==1)return null;const ref=v.selected[0],floor=v.project.floors.find(f=>f.id===ref.floorId);if(!floor||!['wall','solid'].includes(ref.kind)||locked(floor,ref))return null;const o=entity(floor,ref);if(o.hidden||v.options.floor!=='all'&&v.options.floor!==floor.id)return null;return {ref,floor,o};};
 const elevation=f=>{const i=v.project.floors.indexOf(f);return floorElevation(v.project,i)+(v.options.exploded?i*2.3:0);};
 const refEqual=(a,b)=>a?.id===b?.id&&a?.floorId===b?.floorId&&a?.kind===b?.kind;
 const owner=o=>{while(o&&!o.userData.entity)o=o.parent;return o?.userData.entity;};
 const clearHighlight=()=>{if(highlight){v.scene.remove(highlight);highlight.geometry.dispose();highlight.material.dispose();highlight=null;}v.pullHighlight=null;highlightKey='';highlightRoot=null;};
 const clearChosen=()=>{chosen=null;clearHighlight();grip.hidden=form.hidden=true;result.textContent='';number.value='0';};
 const target=()=>{
  const t=selected();if(!t)return null;
  if(!chosen||!refEqual(chosen.ref,t.ref)){chosen={ref:t.ref,face:{type:'top'},offset:new THREE.Vector3()};number.value='0';result.textContent='';lastDelta=0;}
  const info=pullFaceInfo(t.floor,t.ref,chosen.face);if(!info)return null;
  const base=elevation(t.floor),point=new THREE.Vector3(...info.point).add(chosen.offset);point.y+=base;return {...t,info,point,base,face:chosen.face};
 };
 function showHighlight(t){
  let root=null;v.model.traverse(o=>{if(refEqual(o.userData.entity,t.ref))root=o;});
  const key=JSON.stringify([t.ref,t.face,t.base]);if(root===highlightRoot&&key===highlightKey)return;clearHighlight();if(!root)return;
  root.updateWorldMatrix(true,true);const vertices=[],a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),center=new THREE.Vector3(),normal=new THREE.Vector3();
  root.traverse(o=>{if(!o.isMesh||!refEqual(owner(o),t.ref))return;const p=o.geometry.attributes.position,index=o.geometry.index,count=index?index.count:p.count;
   for(let i=0;i<count;i+=3){a.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(o.matrixWorld);b.fromBufferAttribute(p,index?index.getX(i+1):i+1).applyMatrix4(o.matrixWorld);c.fromBufferAttribute(p,index?index.getX(i+2):i+2).applyMatrix4(o.matrixWorld);normal.copy(b).sub(a).cross(c.clone().sub(a)).normalize();center.copy(a).add(b).add(c).multiplyScalar(1/3);center.y-=t.base;
    if(samePullFace(resolvePullFace(t.floor,t.ref,center.toArray(),normal.toArray()),t.face))vertices.push(...a.toArray(),...b.toArray(),...c.toArray());
   }
  });
  if(vertices.length){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));highlight=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:'#df9565',transparent:true,opacity:.5,side:THREE.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));highlight.name='推拉选面';v.pullHighlight=highlight;v.scene.add(highlight);}
  highlightRoot=root;highlightKey=key;
 }
 v.updatePushPull=()=>{
  const t=target();if(!t){if(drag)finish(true);clearChosen();return;}
  const q=pixel(t.point);grip.hidden=q.z<-1||q.z>1||q.x<0||q.y<0||q.x>v.host.clientWidth||q.y>v.host.clientHeight||!!(v.sectionPlane&&v.sectionPlane.distanceToPoint(t.point)<0);
  if(!grip.hidden){grip.style.left=q.x+'px';grip.style.top=q.y+'px';grip.textContent=(t.face.type==='top'?'↕ ':'↔ ')+t.info.label+(t.info.dimension!=null?' '+t.info.dimension.toFixed(2)+' m':'');grip.setAttribute('aria-label','拖动推拉'+t.info.label);}
  form.hidden=false;name.textContent=t.info.label+(t.info.dimension!=null?' · '+t.info.dimensionLabel+' '+t.info.dimension.toFixed(2)+' m':'');showHighlight(t);
 };
 function pick(e){
  const r=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),v.camera);v.model.updateMatrixWorld(true);
  // Stop at the nearest visible mesh, so furniture, locked walls and roofs occlude faces.
  const hit=ray.intersectObject(v.model,true).find(h=>{if(!h.object.isMesh||v.sectionPlane&&v.sectionPlane.distanceToPoint(h.point)<-.001)return false;let o=h.object;while(o){if(!o.visible)return false;o=o.parent;}return true;});
  if(!hit)return null;const ref=owner(hit.object),floor=v.project.floors.find(f=>f.id===ref?.floorId);if(!floor||!['wall','solid'].includes(ref.kind)||locked(floor,ref))return null;
  const point=hit.point.clone();point.y-=elevation(floor);const normal=hit.face.normal.clone().transformDirection(hit.object.matrixWorld),face=resolvePullFace(floor,ref,point.toArray(),normal.toArray());return face?{ref,floor,point,face}:null;
 }
 function begin(e,t,source){
  if(v.onPushPullEdit?.('start',t.ref,t.face)===false)return false;
  const a=pixel(t.point),b=pixel(t.point.clone().add(new THREE.Vector3(...t.info.normal)));let dx=b.x-a.x,dy=b.y-a.y;
  if(Math.hypot(dx,dy)<8){dx=0;dy=-Math.max(25,v.host.clientHeight/(2*Math.tan(THREE.MathUtils.degToRad(v.camera.fov/2))*v.camera.position.distanceTo(t.point)));}
  e.preventDefault();e.stopImmediatePropagation();const orbitEnabled=v.orbit.enabled,damping=v.orbit.enableDamping;
  v.orbit.enableDamping=false;v.orbit.update();v.orbit.enabled=false;v.orbit.enableDamping=damping;
  drag={ref:t.ref,face:t.face,x:e.clientX,y:e.clientY,dx,dy,source,pointerId:e.pointerId,orbitEnabled,started:false};lastDelta=0;number.value='0';result.textContent='';source.setPointerCapture(e.pointerId);return true;
 }
 canvas.addEventListener('pointerdown',e=>{
  if(!enabled()||e.button!==0||e.shiftKey||e.ctrlKey||e.metaKey)return;const hit=pick(e);if(!hit)return;
  v.onSelect(hit.ref,e);if(!selected()||!refEqual(selected().ref,hit.ref))return;
  const info=pullFaceInfo(hit.floor,hit.ref,hit.face);chosen={ref:hit.ref,face:hit.face,offset:hit.point.clone().sub(new THREE.Vector3(...info.point))};v.updatePushPull();begin(e,target(),canvas);
 },true);
 grip.addEventListener('pointerdown',e=>{const t=target();if(e.button===0&&t)begin(e,t,grip);});
 const move=e=>{
  if(!drag||e.pointerId!==drag.pointerId)return;e.preventDefault();e.stopImmediatePropagation();
  const d=drag;if(!d.started&&Math.hypot(e.clientX-d.x,e.clientY-d.y)<3)return;d.started=true;
  const scale=e.shiftKey?1000:100,delta=Math.round(projectedDragDelta(e.clientX-d.x,e.clientY-d.y,d.dx,d.dy)*scale)/scale;
  if(delta===lastDelta)return;const response=v.onPushPullEdit?.('preview',d.ref,d.face,delta);
  if(response?.ok){lastDelta=delta;number.value=String(delta);result.textContent=(delta>=0?'拉出 ':'推入 ')+Math.abs(delta).toFixed(3)+' m';}else result.textContent=response?.error||'这个距离无法推拉';
 };
 function finish(cancel=false){
  if(!drag)return;const d=drag;drag=null;v.orbit.enabled=d.orbitEnabled;
  if(d.source.hasPointerCapture(d.pointerId))d.source.releasePointerCapture(d.pointerId);
  v.onPushPullEdit?.(cancel?'cancel':'commit',d.ref,d.face);number.value='0';
  if(cancel)result.textContent='已取消本次推拉';else if(d.started)result.textContent=(lastDelta>=0?'已拉出 ':'已推入 ')+Math.abs(lastDelta).toFixed(3)+' m';
 }
 for(const el of [canvas,grip]){
  el.addEventListener('pointermove',move,true);el.addEventListener('pointerup',e=>{if(!drag||e.pointerId!==drag.pointerId)return;e.preventDefault();e.stopImmediatePropagation();finish(false);},true);
  for(const event of ['pointercancel','lostpointercapture'])el.addEventListener(event,()=>finish(true),true);
 }
 grip.addEventListener('click',e=>e.stopPropagation());
 form.addEventListener('pointerdown',e=>e.stopPropagation());
 form.addEventListener('submit',e=>{
  e.preventDefault();const t=target(),value=Number(number.value);if(!t||!number.value.trim()||!Number.isFinite(value)){result.textContent='请输入推拉距离';return;}
  if(v.onPushPullEdit?.('start',t.ref,t.face)===false)return;
  const response=v.onPushPullEdit?.('preview',t.ref,t.face,value);v.onPushPullEdit?.(response?.ok?'commit':'cancel',t.ref,t.face);
  if(response?.ok){result.textContent=(value>=0?'已拉出 ':'已推入 ')+Math.abs(value).toFixed(3)+' m';number.value='0';}else result.textContent=response?.error||'这个距离无法推拉';
 });
 form.querySelector('button[type="button"]').onclick=()=>{finish(true);clearChosen();v.onPushPullDone?.();};
 window.addEventListener('keydown',e=>{if(!drag)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();finish(true);}else if((e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())){e.preventDefault();e.stopImmediatePropagation();}},true);
 window.addEventListener('blur',()=>finish(true));document.addEventListener('visibilitychange',()=>{if(document.hidden)finish(true);});
 v.cancelPushPull=()=>finish(true);
}
