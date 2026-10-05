import {clone,uid,length,onWall,furnitureBounds,canPlaceOpening,checkRoomEdit,validateProject} from './model.js';
import {phaseVisible} from './renovation.js';

export const lists={wall:'walls',opening:'openings',room:'rooms',furniture:'furniture',stair:'stairs',solid:'solids'};
export const entities=f=>Object.entries(lists).flatMap(([kind,key])=>(f[key]||[]).map(o=>({kind,id:o.id,o})));
export const entity=(f,ref)=>ref&&f[lists[ref.kind]]?.find(o=>o.id===ref.id);
export const hidden=(f,ref)=>{const o=entity(f,ref);return !o||!!o.hidden||(ref.kind==='opening'&&!!f.walls.find(w=>w.id===o.wallId)?.hidden);};
export const locked=(f,ref)=>{const o=entity(f,ref);return !o||!!o.locked||(ref.kind==='opening'&&!!f.walls.find(w=>w.id===o.wallId)?.locked);};
export function expandSelection(f,refs,{attached=false}={}){
 const all=entities(f).filter(r=>phaseVisible(r.o)),ids=new Set(refs.map(r=>r.id));
 let previous=-1;while(previous!==ids.size){previous=ids.size;const groups=new Set(all.filter(r=>ids.has(r.id)).map(r=>r.o.groupId).filter(Boolean));
  all.forEach(r=>{if(groups.has(r.o.groupId))ids.add(r.id);});
  if(attached)all.filter(r=>r.kind==='opening'&&ids.has(r.o.wallId)).forEach(r=>ids.add(r.id));
 }
 return all.filter(r=>ids.has(r.id)).map(({kind,id})=>({kind,id,floorId:f.id}));
}
export function assertEditable(f,refs){if(!refs.length)throw new Error('请先选择构件');if(refs.some(r=>locked(f,r)))throw new Error('选中内容或所属墙已锁定，请先在构件列表解锁');}
export function assertLocksPreserved(before,after){
 const content=o=>{const v=clone(o);delete v.locked;delete v.hidden;return JSON.stringify(v);};
 for(const f of before.floors){const next=after.floors.find(q=>q.id===f.id);if(!next)continue;
  for(const ref of entities(f).filter(r=>locked(f,r))){const o=entity(next,ref);if(!o||content(o)!==content(ref.o))throw new Error('操作会改动锁定的构件，请先解锁');}
  if(f.image?.locked&&(!next.image||['x','y','width','data'].some(k=>f.image[k]!==next.image[k])))throw new Error('底图已锁定，请先在构件列表解锁');
 }
}
export function selectionBounds(f,refs){
 const points=[];
 for(const ref of refs){const o=entity(f,ref);if(!o)continue;
  if(ref.kind==='wall'){const l=length(o),nx=-(o.b.y-o.a.y)/l*o.thickness/2,ny=(o.b.x-o.a.x)/l*o.thickness/2;for(const p of [o.a,o.b])for(const side of [-1,1])points.push({x:p.x+side*nx,y:p.y+side*ny});}
  else if(['room','solid'].includes(ref.kind))points.push(...o.poly.map(([x,y])=>({x,y})));
  else if(ref.kind==='opening'){const w=f.walls.find(w=>w.id===o.wallId);points.push(onWall(w,o.offset-o.width/2),onWall(w,o.offset+o.width/2));}
  else{const b=furnitureBounds(o);points.push({x:b.x0,y:b.y0},{x:b.x1,y:b.y1});}
 }
 if(!points.length)return null;
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
 return{x0,x1,y0,y1,x:(x0+x1)/2,y:(y0+y1)/2,w:x1-x0,d:y1-y0};
}
export function boxSelection(f,a,b,{kind='all'}={}){
 const x0=Math.min(a.x,b.x),x1=Math.max(a.x,b.x),y0=Math.min(a.y,b.y),y1=Math.max(a.y,b.y);
 return expandSelection(f,entities(f).filter(r=>!hidden(f,r)&&!locked(f,r)&&(kind==='all'||r.kind===kind)).filter(r=>{
  const q=selectionBounds(f,[r]);return q.x0>=x0&&q.x1<=x1&&q.y0>=y0&&q.y1<=y1;
 }));
}
export function groupSelection(f,refs){
 const all=expandSelection(f,refs,{attached:true});assertEditable(f,all);if(all.length<2)throw new Error('至少选择两个构件才能成组');
 const id=uid(),used=new Set(entities(f).map(r=>r.o.groupName));let n=1;while(used.has(`组合 ${n}`))n++;
 all.forEach(r=>Object.assign(entity(f,r),{groupId:id,groupName:`组合 ${n}`}));return all;
}
export function ungroupSelection(f,refs){const all=expandSelection(f,refs);assertEditable(f,all);all.forEach(r=>{const o=entity(f,r);delete o.groupId;delete o.groupName;});}
export function setFlag(f,refs,key,value){
 if(!['hidden','locked'].includes(key))throw new Error('无效的构件状态');
 expandSelection(f,refs,{attached:true}).forEach(r=>entity(f,r)[key]=!!value);
}
export function removeSelection(f,refs){
 const all=expandSelection(f,refs,{attached:true});assertEditable(f,all);const ids=new Set(all.map(r=>r.id));
 for(const key of Object.values(lists))f[key]=(f[key]||[]).filter(o=>!ids.has(o.id));
}
// Apply to a private copy first: an invalid array/opening cannot partly change the floor.
export function transformSelection(f,refs,{dx=0,dy=0,angle=0,mirror=null,copy=false,count=1}={}){
 if(![dx,dy,angle].every(Number.isFinite)||Math.abs(dx)>500||Math.abs(dy)>500||Math.abs(angle)>3600||!Number.isInteger(count)||count<1||count>50||!['x','y',null].includes(mirror))throw new Error('请输入有效的距离、角度和份数（1–50）');
 const all=expandSelection(f,refs,{attached:true});assertEditable(f,all);
 const next=clone(f),ids=new Set(all.map(r=>r.id)),b=selectionBounds(f,all),c={x:b.x,y:b.y},rad=angle*Math.PI/180,cos=Math.cos(rad),sin=Math.sin(rad);
 const moved=[],iterations=copy?count:1;
 const point=(p,i)=>{let x=p.x-c.x,y=p.y-c.y;if(mirror==='x')x=-x;if(mirror==='y')y=-y;return{x:c.x+x*cos-y*sin+dx*i,y:c.y+x*sin+y*cos+dy*i};};
 for(let i=1;i<=iterations;i++){
  const map=new Map(all.map(r=>[r.id,copy?uid():r.id])),groups=new Map();
  for(const ref of all){const source=entity(f,ref),o=clone(source);o.id=map.get(ref.id);if(copy)delete o.code;
   if(copy&&o.groupId){if(!groups.has(o.groupId))groups.set(o.groupId,uid());o.groupId=groups.get(o.groupId);o.groupName=(o.groupName||'组合')+' · 副本';}
   if(ref.kind==='wall'){o.a=point(source.a,i);o.b=point(source.b,i);o.inferred=false;}
   else if(ref.kind==='opening'){
    if(ids.has(source.wallId)){o.wallId=map.get(source.wallId);}
    else{if(angle%360)throw new Error('旋转门窗时请连同所属墙一起选中');const w=f.walls.find(w=>w.id===source.wallId),p=point(onWall(w,source.offset),i),l=length(w),perpendicular=Math.abs((p.x-w.a.x)*(w.b.y-w.a.y)-(p.y-w.a.y)*(w.b.x-w.a.x))/l;if(perpendicular>.005)throw new Error('单独移动或复制门窗时，请沿所属墙的方向；也可连墙一起选中');o.offset=((p.x-w.a.x)*(w.b.x-w.a.x)+(p.y-w.a.y)*(w.b.y-w.a.y))/l;}
    if(mirror)o.hinge=-(o.hinge||1);
   }else if(['room','solid'].includes(ref.kind)){const transform=poly=>poly.map(([x,y])=>{const p=point({x,y},i);return[p.x,p.y];});o.poly=transform(source.poly);if(ref.kind==='room')o.manual=true;else o.holes=(source.holes||[]).map(transform);}
   else{Object.assign(o,point(source,i));o.rot=(((mirror==='x'?-source.rot:mirror==='y'?180-source.rot:source.rot)+angle)%360+360)%360;if(mirror)o.mirrorX=!o.mirrorX;}
   if(copy)next[lists[ref.kind]].push(o);else Object.assign(entity(next,ref),o);
   moved.push({kind:ref.kind,id:o.id,floorId:f.id});
  }
 }
 for(const ref of moved){const o=entity(next,ref);if(ref.kind==='opening'&&!canPlaceOpening(next,o))throw new Error('门窗超出墙体或与其他洞口重叠，请调整间距');if(ref.kind==='room')checkRoomEdit(next,o);}
 validateProject({version:2,units:'m',name:'编辑校验',roof:'none',floors:[{...next,delivery:undefined}]});
 Object.assign(f,next);return moved;
}
export function wallClearance(f,refs,side,gap){
 assertEditable(f,refs);if(!Number.isFinite(gap)||gap<0||gap>100)throw new Error('离墙距离应为 0–100000 毫米');
 const b=selectionBounds(f,refs),excluded=new Set(refs.map(r=>r.id)),x=side==='left'||side==='right',negative=side==='left'||side==='top';
 const candidates=f.walls.filter(w=>phaseVisible(w)&&!w.hidden&&!excluded.has(w.id)&&(x?Math.abs(w.a.x-w.b.x):Math.abs(w.a.y-w.b.y))<.001).filter(w=>{
  const center=x?b.x:b.y,pos=x?w.a.x:w.a.y,lo=x?b.y0:b.x0,hi=x?b.y1:b.x1;
  return (negative?pos<=center:pos>=center)&&Math.max(x?w.a.y:w.a.x,x?w.b.y:w.b.x)>=lo&&Math.min(x?w.a.y:w.a.x,x?w.b.y:w.b.x)<=hi;
 }).map(w=>({w,d:Math.abs((x?w.a.x:w.a.y)-(x?b.x:b.y))})).sort((a,b)=>a.d-b.d);
 if(!candidates.length)throw new Error('这个方向没有相对的横竖墙面');
 const w=candidates[0].w,face=(x?w.a.x:w.a.y)+(negative?1:-1)*w.thickness/2,edge=x?(negative?b.x0:b.x1):(negative?b.y0:b.y1),delta=face+(negative?gap:-gap)-edge;
 return{dx:x?delta:0,dy:x?0:delta};
}
export function snapGuidePoint(p,guides,threshold){
 const next={...p},lines=[];for(const axis of ['x','y']){const best=(guides||[]).filter(g=>!g.hidden&&g.axis===axis&&Math.abs(g.value-p[axis])<threshold).sort((a,b)=>Math.abs(a.value-p[axis])-Math.abs(b.value-p[axis]))[0];if(best){next[axis]=best.value;lines.push({axis,value:best.value,from:p[axis==='x'?'y':'x']-3,to:p[axis==='x'?'y':'x']+3});}}
 return{point:next,guides:lines,label:lines.length?'参考线吸附':''};
}
