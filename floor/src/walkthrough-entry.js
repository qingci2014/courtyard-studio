import {Viewer} from './viewer.js';
import {bounds,pointIn,validateProject} from './model.js';

const $=s=>document.querySelector(s),ns='http://www.w3.org/2000/svg';
let viewer,project,currentFloorId,toastTimer,lastFloorId,lastRoomId,lastTick=0;
const svg=(tag,attrs)=>{const el=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,String(value));return el;};
const option=(label,value,disabled=false)=>{const o=document.createElement('option');o.textContent=label;o.value=value;o.disabled=disabled;return o;};
const toast=message=>{clearTimeout(toastTimer);$('#tourToast').textContent=message;$('#tourToast').hidden=false;toastTimer=setTimeout(()=>$('#tourToast').hidden=true,3500);};
const available=f=>f.walls.length||f.rooms.length||f.solids.length||f.furniture.length;
function renderFloor(){
 const f=project.floors.find(f=>f.id===currentFloorId);$('#tourFloor').value=f.id;$('#tourRoom').replaceChildren(option('选择房间进入',''),...f.rooms.map(r=>option(r.name,r.id)));$('#tourRoom').disabled=!f.rooms.length;$('#tourMapFloor').textContent=f.name;
 const map=$('#tourMap'),b=bounds(f),pad=Math.max(b.w,b.h)*.06;map.setAttribute('viewBox',`${b.x-pad} ${b.y-pad} ${b.w+pad*2} ${b.h+pad*2}`);map.replaceChildren();
 for(const r of f.rooms)map.append(svg('polygon',{points:r.poly.map(p=>p.join(',')).join(' '),fill:'#e8e1d4',stroke:'#c7c0b4','stroke-width':.025}));
 for(const w of f.walls)map.append(svg('line',{x1:w.a.x,y1:w.a.y,x2:w.b.x,y2:w.b.y,stroke:'#78838a','stroke-width':w.thickness,'stroke-linecap':'square'}));
 for(const o of f.openings){const w=f.walls.find(w=>w.id===o.wallId);if(!w)continue;const length=Math.hypot(w.b.x-w.a.x,w.b.y-w.a.y),x=(w.b.x-w.a.x)/length,y=(w.b.y-w.a.y)/length;map.append(svg('line',{x1:w.a.x+x*(o.offset-o.width/2),y1:w.a.y+y*(o.offset-o.width/2),x2:w.a.x+x*(o.offset+o.width/2),y2:w.a.y+y*(o.offset+o.width/2),stroke:o.type==='door'?'#e8e1d4':'#9bb2c0','stroke-width':w.thickness+.025}));}
 const marker=svg('g',{id:'tourMarker'}),scale=Math.max(b.w,b.h)*.016;marker.append(svg('path',{d:`M0 ${-scale*2.8} L${-scale*1.7} ${-scale*.1} L${scale*1.7} ${-scale*.1} Z`,fill:'#d9825977'}),svg('circle',{cx:0,cy:0,r:scale,class:'person'}));map.append(marker);lastFloorId=f.id;lastRoomId=null;
}
function syncMode(){
 const walk=!!viewer?.walk;if(viewer){viewer.camera.fov=walk?75:43;viewer.camera.updateProjectionMatrix();}$('#tourWalk').classList.toggle('active',walk);$('#tourOverview').classList.toggle('active',!walk);$('#tourWalk').setAttribute('aria-pressed',String(walk));$('#tourOverview').setAttribute('aria-pressed',String(!walk));$('#tourWalkControls').hidden=!walk;$('#tourCrosshair').hidden=!walk;
 if($('#tourMarker'))$('#tourMarker').style.display=walk?'':'none';if(!walk)$('#tourLocation').textContent='建筑总览 · 拖动旋转，滚轮缩放';
}
function enter(roomId){
 try{viewer.startWalk(currentFloorId,roomId);$('#tourCanvas').focus({preventScroll:true});}catch(error){lastRoomId=null;toast(error.message);}finally{syncMode();}
}
function overview(){viewer.stopWalk();viewer.options.floor='all';viewer.update(project,{floor:'all',cut:false,exploded:false});viewer.fit();syncMode();}
function showHelp(show){$('#tourHelpPanel').hidden=!show;$('#tourHelp').setAttribute('aria-expanded',String(show));if(show)viewer.keys.clear();}
function tick(now){
 requestAnimationFrame(tick);if(now-lastTick<90)return;lastTick=now;if(!viewer.walk)return;
 if(viewer.walkFloorId!==currentFloorId){currentFloorId=viewer.walkFloorId;renderFloor();}
 const f=project.floors.find(f=>f.id===currentFloorId),p={x:viewer.camera.position.x,y:viewer.camera.position.z},room=f.rooms.find(r=>pointIn(p,r.poly));
 $('#tourMarker')?.setAttribute('transform',`translate(${p.x.toFixed(3)} ${p.y.toFixed(3)}) rotate(${(-viewer.yaw*180/Math.PI).toFixed(1)})`);
 if(lastRoomId!==(room?.id||'')){lastRoomId=room?.id||'';$('#tourRoom').value=lastRoomId;$('#tourLocation').textContent=room?.name||'室外 / 通道';}
}
try{
 const data=JSON.parse($('#tourData').textContent);project=validateProject(data.project);currentFloorId=project.floors.find(f=>f.id===data.initialFloorId)?.id||project.floors.find(available)?.id;
 viewer=new Viewer($('#tourCanvas'),()=>{},syncMode);viewer.update(project,{floor:'all',includeHidden:true,blueprint:false,furniture:true,roofVisible:true,cut:false});viewer.fit();
 $('#tourFloor').replaceChildren(...project.floors.map((f,i)=>option(`${i+1}F · ${f.name}${available(f)?'':'（未建模）'}`,f.id,!available(f))));renderFloor();
 $('#tourFloor').onchange=e=>{viewer.keys.clear();currentFloorId=e.target.value;renderFloor();enter();};$('#tourRoom').onchange=e=>{if(e.target.value)enter(e.target.value);};
 $('#tourWalk').onclick=()=>enter($('#tourRoom').value||undefined);$('#tourOverview').onclick=overview;$('#tourReset').onclick=()=>enter();
 $('#tourFullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('可以使用浏览器的 F11 键进入全屏');}};
 document.addEventListener('fullscreenchange',()=>$('#tourFullscreen').textContent=document.fullscreenElement?'退出全屏':'全屏');
 $('#tourHelp').onclick=()=>showHelp($('#tourHelpPanel').hidden);$('#tourHelpClose').onclick=()=>{showHelp(false);$('#tourCanvas').focus({preventScroll:true});};
 $('#tourMapToggle').onclick=()=>{const map=$('#tourMap');map.hidden=!map.hidden;$('#tourMapToggle').textContent=map.hidden?'展开平面':'收起平面';$('#tourMapToggle').setAttribute('aria-expanded',String(!map.hidden));};
 for(const button of document.querySelectorAll('[data-walk-key]')){
  const release=()=>{viewer.keys.delete(button.dataset.walkKey);button.classList.remove('held');};
  button.onpointerdown=e=>{if(!viewer.walk)return;e.preventDefault();button.setPointerCapture(e.pointerId);viewer.keys.add(button.dataset.walkKey);button.classList.add('held');showHelp(false);};
  button.onpointerup=button.onpointercancel=button.onlostpointercapture=release;
 }
 const clearKeys=()=>{viewer.keys.clear();document.querySelectorAll('.held').forEach(b=>b.classList.remove('held'));};window.addEventListener('blur',clearKeys);document.addEventListener('visibilitychange',clearKeys);
 window.addEventListener('keydown',e=>{if(e.target.closest('input,select,textarea'))return;if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){showHelp(false);if(e.target.tagName==='BUTTON')e.preventDefault();}});
 $('#tourLoading').hidden=true;enter();requestAnimationFrame(tick);
}catch(error){document.body.classList.add('fatal');$('#tourLoading').hidden=false;$('#tourLoadingText').textContent='无法启动三维画面。请用 Chrome 或 Edge 打开，并确认浏览器已启用图形加速。'+(error.message?'（'+error.message+'）':'');console.error(error);}
