import * as THREE from 'three';
import {clamp} from './model.js';
import {normalizeSection,sectionEquation,sceneBounds,projectedDragDelta} from './modeling.js';
import {installPushPullViewer} from './push-pull-viewer.js';
import {installOpeningViewer} from './opening-viewer.js';

export function installModelingViewer(v){
 const plane=new THREE.Plane(),panel=new THREE.Group();panel.name='剖切辅助面';v.scene.add(panel);
 const face=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:0x7799ad,transparent:true,opacity:.07,side:THREE.DoubleSide,depthWrite:false}));
 const edges=new THREE.LineSegments(new THREE.EdgesGeometry(face.geometry),new THREE.LineBasicMaterial({color:0x4f6d86,transparent:true,opacity:.7}));panel.add(face,edges);panel.visible=false;
 const button=(label,cls)=>{const b=document.createElement('button');b.className='model-grip '+cls;b.setAttribute('aria-label',label);b.title=label;b.hidden=true;v.host.append(b);return b;};
 const sectionGrip=button('拖动剖切面','section-grip');let drag=null;
 installPushPullViewer(v);
 installOpeningViewer(v);
 const pixel=p=>{const q=p.clone().project(v.camera);return {x:(q.x+1)*v.host.clientWidth/2,y:(1-q.y)*v.host.clientHeight/2,z:q.z};};
 const place=(el,p)=>{const q=pixel(p);el.hidden=q.z<-1||q.z>1||q.x<0||q.y<0||q.x>v.host.clientWidth||q.y>v.host.clientHeight;if(!el.hidden){el.style.left=q.x+'px';el.style.top=q.y+'px';}};
 v.setSection=(section=v.options.section,enabled=v.options.cut)=>{
  const s=normalizeSection(section);v.options.section=s;v.options.cut=!!enabled;const eq=sectionEquation(s);plane.normal.fromArray(eq.normal);plane.constant=eq.constant;
  v.sectionPlane=enabled&&!v.walk?plane:null;v.renderer.clippingPlanes=v.sectionPlane?[plane]:[];
  panel.visible=!!enabled&&!v.walk&&s.showPlane;
  if(v.project){const b=sceneBounds(v.project,v.options),x=(b.x[0]+b.x[1])/2,y=(b.y[0]+b.y[1])/2,h=(b.height[0]+b.height[1])/2;
   panel.rotation.set(0,0,0);if(s.axis==='height'){panel.rotation.x=-Math.PI/2;panel.position.set(x,s.position,y);panel.scale.set(b.x[1]-b.x[0],b.y[1]-b.y[0],1);}else if(s.axis==='x'){panel.rotation.y=Math.PI/2;panel.position.set(s.position,h,y);panel.scale.set(b.y[1]-b.y[0],b.height[1]-b.height[0],1);}else{panel.position.set(x,h,s.position);panel.scale.set(b.x[1]-b.x[0],b.height[1]-b.height[0],1);}}
  v.updateModelingHandles();
 };
 v.updateModelingHandles=()=>{
  v.updatePushPull();
  v.updateOpeningHandles();
  sectionGrip.hidden=!panel.visible;if(panel.visible){sectionGrip.textContent=(v.options.section.axis==='height'?'↕ 高度':'↔ '+v.options.section.axis.toUpperCase())+' '+v.options.section.position.toFixed(2)+' m';place(sectionGrip,panel.position);}
 };
 const start=e=>{
  if(e.button!==0||v.walk)return;const target={point:panel.position.clone(),height:v.options.section.position};
  e.preventDefault();e.stopPropagation();const worldAxis=v.options.section.axis==='height'?new THREE.Vector3(0,1,0):v.options.section.axis==='x'?new THREE.Vector3(1,0,0):new THREE.Vector3(0,0,1),a=pixel(target.point),b=pixel(target.point.clone().add(worldAxis));let dx=b.x-a.x,dy=b.y-a.y;
  if(Math.hypot(dx,dy)<8){dx=0;dy=-40;}
  drag={value:target.height,x:e.clientX,y:e.clientY,dx,dy,button:e.currentTarget};v.orbit.enabled=false;e.currentTarget.setPointerCapture(e.pointerId);
 };
 const move=e=>{if(!drag)return;e.preventDefault();const d=drag,delta=projectedDragDelta(e.clientX-d.x,e.clientY-d.y,d.dx,d.dy);let value=Math.round((d.value+delta)*(e.shiftKey?100:20))/(e.shiftKey?100:20);
  const limits=sceneBounds(v.project,v.options)[v.options.section.axis];value=clamp(value,...limits);v.onSectionEdit?.({...v.options.section,position:value});
 };
 const end=cancel=>{if(!drag)return;const d=drag;drag=null;v.orbit.enabled=true;if(cancel)v.onSectionEdit?.({...v.options.section,position:d.value});};
 sectionGrip.addEventListener('pointerdown',start);sectionGrip.addEventListener('pointermove',move);sectionGrip.addEventListener('pointerup',()=>end(false));sectionGrip.addEventListener('pointercancel',()=>end(true));sectionGrip.addEventListener('lostpointercapture',()=>end(true));sectionGrip.addEventListener('click',e=>e.stopPropagation());
 window.addEventListener('keydown',e=>{if(drag&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();end(true);}},true);
 window.addEventListener('blur',()=>end(true));
 v.captureCamera=()=>({position:v.camera.position.toArray(),target:v.orbit.target.toArray()});
 v.restoreCamera=camera=>{if(v.walk)v.stopWalk();const damping=v.orbit.enableDamping;v.orbit.enableDamping=false;v.orbit.update();v.camera.position.fromArray(camera.position);v.orbit.target.fromArray(camera.target);v.camera.lookAt(v.orbit.target);v.orbit.update();v.orbit.enableDamping=damping;v.updateModelingHandles();};
 v.sectionHelper=panel;
}
