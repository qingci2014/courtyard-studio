import {validateDelivery,phaseVisible,constructionStatus,remapFloorDelivery,scaleFloorDelivery} from './renovation.js';
import reference from './reference-sample.json' with {type:'json'};
import {roomBoundaryWalls,roomLabelPoint,cleanRoomPolygon,checkRoomPolygon,polygonsOverlap,polygonContains} from './room-geometry.js';
import {validateSolid,validateScene} from './modeling.js';
export {roomLabelPoint};

export const uid = () => crypto.randomUUID();
export const clone = v => structuredClone(v);
export const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
export const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
export const length = w => dist(w.a,w.b);
export const area = poly => Math.abs(signedArea(poly));
export const signedArea = poly => poly.reduce((s,p,i)=>{const q=poly[(i+1)%poly.length];return s+p[0]*q[1]-q[0]*p[1];},0)/2;
export const centroid = poly => ({x:poly.reduce((s,p)=>s+p[0],0)/poly.length,y:poly.reduce((s,p)=>s+p[1],0)/poly.length});
export const pointIn = (p,poly) => {let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(((a[1]>p.y)!==(b[1]>p.y))&&p.x<(b[0]-a[0])*(p.y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
export function projection(p,w){const l=length(w);if(l<1e-6)return{point:{...w.a},offset:0,distance:dist(p,w.a)};const t=clamp(((p.x-w.a.x)*(w.b.x-w.a.x)+(p.y-w.a.y)*(w.b.y-w.a.y))/(l*l),0,1);const point={x:w.a.x+t*(w.b.x-w.a.x),y:w.a.y+t*(w.b.y-w.a.y)};return{point,offset:t*l,distance:dist(p,point)};}
export function nearestWall(p,floor,max=.55){let hit=null;for(const w of floor.walls){const q=projection(p,w);if(q.distance<max){max=q.distance;hit={wall:w,...q};}}return hit;}
export function onWall(w,offset){const t=offset/length(w);return{x:w.a.x+(w.b.x-w.a.x)*t,y:w.a.y+(w.b.y-w.a.y)*t};}
export function bounds(floor,includeImage=false){let pts=floor.walls.flatMap(w=>[w.a,w.b]);[...floor.rooms,...(floor.solids||[])].forEach(o=>pts.push(...o.poly.map(([x,y])=>({x,y}))));floor.furniture.forEach(f=>pts.push({x:f.x-f.w/2,y:f.y-f.d/2},{x:f.x+f.w/2,y:f.y+f.d/2}));if(includeImage&&floor.image){const i=floor.image;pts.push({x:i.x,y:i.y},{x:i.x+i.width,y:i.y+i.width*i.pixelHeight/i.pixelWidth});}if(includeImage&&floor.cad)floor.cad.segments.forEach(s=>pts.push(s.a,s.b));if(!pts.length)return{x:0,y:0,w:12,h:10};const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys);return{x,y,w:Math.max(.5,Math.max(...xs)-x),h:Math.max(.5,Math.max(...ys)-y)};}
export const makeFloor=(name='1 层')=>({id:uid(),name,height:2.8,walls:[],openings:[],rooms:[],furniture:[],stairs:[],solids:[],image:null});
export function normalizeEmptyFloorName(project){
 if(project.floors.length!==1)return false;
 const f=project.floors[0];
 if(f.nameEdited||f.image||f.cad||['walls','openings','rooms','furniture','stairs','solids'].some(key=>f[key]?.length))return false;
 if(!/^\s*(?:\d+|[一二三四五六七八九十]+)\s*层\s*$/.test(f.name)||f.name==='1 层')return false;
 f.name='1 层';return true;
}
// Calibrate plan geometry in XY; storey heights and vertical opening sizes stay in metres.
export function calibrateFloor(f,a,b,metres,{scaleModel=false}={}){
 const span=dist(a,b),ratio=metres/span;
 if(!f.image||!Number.isFinite(ratio)||span<.08||!Number.isFinite(metres)||metres<.1||metres>200)throw new Error('请输入 0.1–200 米之间的实际长度');
 const next=clone(f),point=p=>({x:a.x+(p.x-a.x)*ratio,y:a.y+(p.y-a.y)*ratio});
 Object.assign(next.image,point(next.image),{width:next.image.width*ratio,calibrated:true});
 if(next.image.crop){const c=next.image.crop;next.image.crop={...point(c),w:c.w*ratio,h:c.h*ratio};}
 if(scaleModel){
  next.walls.forEach(w=>{w.a=point(w.a);w.b=point(w.b);w.thickness*=ratio;});
  next.openings.forEach(o=>{o.offset*=ratio;o.width*=ratio;});
  next.rooms.forEach(r=>{r.poly=r.poly.map(([x,y])=>{const p=point({x,y});return[p.x,p.y];});});
  next.solids?.forEach(o=>{const scale=poly=>poly.map(([x,y])=>{const p=point({x,y});return[p.x,p.y];});o.poly=scale(o.poly);o.holes=(o.holes||[]).map(scale);});
  [...next.furniture,...next.stairs].forEach(o=>Object.assign(o,point(o),{w:o.w*ratio,d:o.d*ratio}));
  scaleFloorDelivery(next,a,ratio);
  next.guides?.forEach(g=>g.value=a[g.axis]+(g.value-a[g.axis])*ratio);
  next.cad?.segments.forEach(s=>{s.a=point(s.a);s.b=point(s.b);if(Number.isFinite(s.width))s.width*=ratio;});
  if(next.cad?.modeling)next.cad.modeling.thickness*=ratio;
 }
 try{const check=clone(next);delete check.delivery;validateProject({version:2,units:'m',name:'尺寸校准',roof:'none',floors:[check]});}
 catch{throw new Error('缩放后的尺寸超出可用范围，请检查选中的两点、图纸数字和单位');}
 Object.assign(f,next);return ratio;
}
export const wall=(a,b,thickness=.2)=>({id:uid(),a:{...a},b:{...b},thickness,color:'#edece5'});
// Calibration changes the coordinate system, not construction intent. Scale the
// saved original by the same factor so before/after drawings remain comparable.
export function calibrateProjectFloor(project,floorId,a,b,metres,options={}){
 const next=clone(project),f=next.floors.find(f=>f.id===floorId);if(!f)throw new Error('楼层不存在');const image=clone(f.image);
 const ratio=calibrateFloor(f,a,b,metres,options),baseline=next.delivery?.baseline?.floors.find(f=>f.id===floorId);
 if(options.scaleModel&&baseline){baseline.image=image;calibrateFloor(baseline,a,b,metres,{scaleModel:true});delete baseline.image;}
 if(next.delivery&&next.delivery.source!=='measured'){if(options.scaleModel)next.delivery.source=next.floors.some(f=>f.image&&!f.image.calibrated)?'estimated':'calibrated';next.delivery.sourceNote=`图纸校准：${f.name}，参照长度 ${metres} m；${options.scaleModel?'模型与原始留档同步缩放':'仅校准底图，模型尺寸依据未改变'}`;}
 validateProject(next);Object.assign(project,next);return ratio;
}
// Resize in the furniture's own axes. The opposite corner/edge stays fixed,
// including after rotation; corners preserve aspect ratio, edges change one axis.
export function resizeFurniture(item,handle,delta){
 const axes={nw:[-1,-1],n:[0,-1],ne:[1,-1],e:[1,0],se:[1,1],s:[0,1],sw:[-1,1],w:[-1,0]},axis=axes[handle];
 if(!axis||![item.x,item.y,item.w,item.d,item.rot,delta.x,delta.y].every(Number.isFinite)||item.w<=0||item.d<=0)throw new Error('家具缩放参数无效');
 const [sx,sy]=axis,a=item.rot*Math.PI/180,c=Math.cos(a),s=Math.sin(a),dx=delta.x*c+delta.y*s,dy=-delta.x*s+delta.y*c;
 let w=item.w,d=item.d;
 if(sx&&sy){const scale=clamp(1+(sx*w*dx+sy*d*dy)/(w*w+d*d),Math.max(.1/w,.1/d),Math.min(40/w,40/d));w*=scale;d*=scale;}
 else if(sx)w=clamp(w+sx*dx,.1,40);else d=clamp(d+sy*dy,.1,40);
 const cx=sx*(w-item.w)/2,cy=sy*(d-item.d)/2;
 return{x:item.x+cx*c-cy*s,y:item.y+cx*s+cy*c,w,d};
}
export function furnitureBounds(item){
 const a=item.rot*Math.PI/180,hx=(Math.abs(Math.cos(a))*item.w+Math.abs(Math.sin(a))*item.d)/2,hy=(Math.abs(Math.sin(a))*item.w+Math.abs(Math.cos(a))*item.d)/2;
 return{x0:item.x-hx,x1:item.x+hx,y0:item.y-hy,y1:item.y+hy,hx,hy};
}
export function snapFurnitureMove(item,position,f,{enabled=true,threshold=.18,grid=.1}={}){
 if(!enabled)return{...position,guides:[],label:''};
 const moving={...item,...position},b=furnitureBounds(moving),best={x:null,y:null};
 const offer=(axis,shift,value,from,to,label,priority=0)=>{
  if(Math.abs(shift)>threshold)return;const old=best[axis];
  if(!old||Math.abs(shift)<Math.abs(old.shift)-.001||Math.abs(Math.abs(shift)-Math.abs(old.shift))<=.001&&priority>old.priority)best[axis]={axis,shift,value,from,to,label,priority};
 };
 for(const w of f.walls.filter(w=>!w.hidden&&phaseVisible(w))){
  if(Math.abs(w.a.x-w.b.x)<.001&&b.y1>=Math.min(w.a.y,w.b.y)-threshold&&b.y0<=Math.max(w.a.y,w.b.y)+threshold){
   const face=w.a.x+(position.x<w.a.x?-1:1)*w.thickness/2,edge=position.x<w.a.x?b.x1:b.x0;
   offer('x',face-edge,face,Math.min(b.y0,w.a.y,w.b.y),Math.max(b.y1,w.a.y,w.b.y),'贴墙',2);
  }
  if(Math.abs(w.a.y-w.b.y)<.001&&b.x1>=Math.min(w.a.x,w.b.x)-threshold&&b.x0<=Math.max(w.a.x,w.b.x)+threshold){
   const face=w.a.y+(position.y<w.a.y?-1:1)*w.thickness/2,edge=position.y<w.a.y?b.y1:b.y0;
   offer('y',face-edge,face,Math.min(b.x0,w.a.x,w.b.x),Math.max(b.x1,w.a.x,w.b.x),'贴墙',2);
  }
 }
 for(const other of f.furniture.filter(o=>!o.hidden&&phaseVisible(o))){
  if(other.id===item.id)continue;const q=furnitureBounds(other);
  const gapX=Math.max(0,q.x0-b.x1,b.x0-q.x1),gapY=Math.max(0,q.y0-b.y1,b.y0-q.y1);
  if(gapX>3||gapY>3)continue;
  const pairsX=[[b.x0,q.x0],[b.x0,q.x1],[b.x1,q.x0],[b.x1,q.x1],[position.x,other.x]],pairsY=[[b.y0,q.y0],[b.y0,q.y1],[b.y1,q.y0],[b.y1,q.y1],[position.y,other.y]];
  if(gapY<=3)for(const [edge,target] of pairsX)offer('x',target-edge,target,Math.min(b.y0,q.y0),Math.max(b.y1,q.y1),'家具对齐',1);
  if(gapX<=3)for(const [edge,target] of pairsY)offer('y',target-edge,target,Math.min(b.x0,q.x0),Math.max(b.x1,q.x1),'家具对齐',1);
 }
 for(const g of f.guides||[]){if(g.hidden)continue;const edges=g.axis==='x'?[b.x0,b.x1,position.x]:[b.y0,b.y1,position.y];for(const edge of edges)offer(g.axis,g.value-edge,g.value,g.axis==='x'?b.y0-2:b.x0-2,g.axis==='x'?b.y1+2:b.x1+2,'参考线对齐',3);}
 const round=v=>Math.round(v/grid)*grid,x=best.x?position.x+best.x.shift:round(position.x),y=best.y?position.y+best.y.shift:round(position.y),guides=Object.values(best).filter(Boolean);
 return{x,y,guides,label:guides.length?[...new Set(guides.map(g=>g.label))].join(' · '):'网格 0.1 m'};
}
export function snapPlanPoint(p,f,threshold,{ignoreWallId}={}){
 let endpoint=null,d=threshold;
 for(const w of f.walls){if(w.hidden||!phaseVisible(w)||w.id===ignoreWallId)continue;for(const ep of [w.a,w.b]){const n=dist(ep,p);if(n<d){d=n;endpoint=ep;}}}
 if(endpoint)return{point:{...endpoint},label:'墙角吸附',guides:[]};
 let hit=null;d=threshold;
 for(const w of f.walls){if(w.hidden||!phaseVisible(w)||w.id===ignoreWallId)continue;const q=projection(p,w);if(q.distance<d){d=q.distance;hit=q.point;}}
 if(hit)return{point:{...hit},label:'墙线吸附',guides:[]};
 return{point:{x:Math.round(p.x*10)/10,y:Math.round(p.y*10)/10},label:'网格 0.1 m',guides:[]};
}
export function blankProject(){return{version:2,id:uid(),name:'未命名建筑',units:'m',roof:'none',floors:[makeFloor()],scenes:[]};}
export function referenceProject(){
 const f=makeFloor(); const rectWall=r=>{const[x,y,X,Y]=r.map(v=>typeof v==='number'?v/1000:v),horizontal=X-x>=Y-y;return wall(horizontal?{x,y:(y+Y)/2}:{x:(x+X)/2,y},horizontal?{x:X,y:(y+Y)/2}:{x:(x+X)/2,y:Y},Math.min(X-x,Y-y));};
 f.walls=reference.WALLS.map((r,i)=>({...rectWall(r),id:'original-wall-'+i,kind:r[4],height:r[4]==='low'?1:null}));
 const opening=(r,type,opts={})=>{const w=rectWall(r);f.walls.push(w);f.openings.push({id:uid(),wallId:w.id,type,offset:length(w)/2,width:length(w),height:type==='window'?1.5:2.1,sill:type==='window'?.9:0,hinge:1,...opts});};
 reference.WINS.forEach((r,i)=>opening(r,'window',{sill:i===0?1.4:i>=6?.45:.9,height:i===0?1: i>=6?1.95:1.5}));
 reference.DOORS.forEach(d=>opening(d.rect,'door'));
 reference.SLIDES.forEach(d=>opening(d.rect,'door',{height:2.4}));
 f.rooms=reference.ROOMS.filter(r=>r.counted!==false).map(r=>({id:r.id,name:r.name,poly:r.poly.map(p=>p.map(n=>n/1000)),mat:r.mat}));f.roomMode='manual';
 f.furniture=reference.furniture.map(o=>({id:uid(),type:o.type,name:o.name,x:o.cx/1000,y:o.cy/1000,w:o.w/1000,d:o.d/1000,rot:o.rot,color:o.color}));
 return{...blankProject(),name:'三室两厅 · 原项目样例',floors:[f]};
}
export function villaProject(){
 const p=blankProject();p.name='两层住宅 · 建模样例';const f=p.floors[0];
 [[0,0,12,0],[12,0,12,9],[12,9,0,9],[0,9,0,0],[5,0,5,9],[5,4,12,4],[8,4,8,9],[0,4.5,5,4.5]].forEach(q=>f.walls.push(wall({x:q[0],y:q[1]},{x:q[2],y:q[3]})));
 const add=(wi,offset,type,width=1.1)=>f.openings.push({id:uid(),wallId:f.walls[wi].id,offset,type,width,height:type==='door'?2.1:1.4,sill:type==='door'?0:.9,hinge:1});
 add(2,9,'door',1.4);add(4,3,'door');add(4,6.6,'door');add(5,1.5,'door');add(6,3.5,'door');add(7,2.5,'door');add(0,2.5,'window',2.4);add(0,8.5,'window',3);add(1,2,'window',1.8);add(1,6.5,'window',2);add(3,2,'window',1.8);add(3,6.6,'window',1.8);
 f.rooms=detectRooms(f);f.rooms.forEach((r,i)=>{r.name=['客餐厅','书房','卧室','厨房','楼梯间'][i]||'房间';});
 f.stairs=[{id:uid(),x:6.5,y:6.5,w:1.15,d:3.8,rot:0}];
 f.furniture=[{id:uid(),type:'sofa',name:'三人沙发',x:2.5,y:1.3,w:2.4,d:.9,rot:0,color:'#aab8a7'},{id:uid(),type:'table',name:'餐桌',x:2.5,y:6.5,w:1.6,d:.8,rot:0,color:'#dac3a5'},{id:uid(),type:'bed',name:'双人床',x:9.8,y:6.5,w:1.8,d:2,rot:0,color:'#c9d6df'}];
 const f2=duplicateFloor(f,'二层');f2.stairs=[];f2.furniture=[];f2.rooms.forEach((r,i)=>r.name=['主卧','次卧','起居室','卫浴','楼梯间'][i]||'房间');p.floors.push(f2);return p;
}
export function duplicateFloor(f,name){const next=clone(f),ids=new Map(),groups=new Map();for(const key of ['walls','openings','rooms','furniture','stairs','solids'])next[key]=(next[key]||[]).filter(o=>phaseVisible(o));if(next.delivery){next.delivery.points=next.delivery.points.filter(o=>phaseVisible(o));next.delivery.dimensions=next.delivery.dimensions.filter(d=>!d.phase||d.phase==='proposed');next.delivery.notes=next.delivery.notes.filter(d=>!d.phase||d.phase==='proposed');}next.id=uid();next.name=name;next.nameEdited=false;next.solids??=[];for(const list of ['walls','openings','rooms','furniture','stairs','solids'])next[list].forEach(o=>{const old=o.id;o.id=uid();ids.set(old,o.id);if(o.groupId){if(!groups.has(o.groupId))groups.set(o.groupId,uid());o.groupId=groups.get(o.groupId);}});next.openings.forEach(o=>o.wallId=ids.get(o.wallId));next.guides?.forEach(g=>g.id=uid());remapFloorDelivery(next,ids);return next;}
export function floorElevation(project,index){return project.floors.slice(0,index).reduce((s,f)=>s+f.height,0);}
export function normalizeOpenings(f){for(const o of f.openings){const w=f.walls.find(w=>w.id===o.wallId);if(!w)continue;const l=length(w);o.width=clamp(o.width,.2,l);o.offset=clamp(o.offset,o.width/2,l-o.width/2);const h=w.height||f.height;o.sill=o.type==='door'?0:clamp(o.sill,0,h-.25);o.height=clamp(o.height,.2,h-o.sill);}f.openings=f.openings.filter(o=>f.walls.some(w=>w.id===o.wallId));}
export function canPlaceOpening(f,o){const w=f.walls.find(w=>w.id===o.wallId);if(!w)return false;const l=length(w);if(o.width>l||o.offset-o.width/2<-.001||o.offset+o.width/2>l+.001)return false;return !f.openings.some(q=>q.id!==o.id&&q.wallId===o.wallId&&!(constructionStatus(q)==='demolish'&&constructionStatus(o)!=='demolish'||constructionStatus(q)==='new'&&constructionStatus(o)==='demolish')&&Math.abs(q.offset-o.offset)<(q.width+o.width)/2+.04);}
export function changeWall(f,base,id,a,b){
 const before=base.walls.find(w=>w.id===id),target=f.walls.find(w=>w.id===id);if(!before||!target)return;
 for(const old of base.walls){const w=f.walls.find(w=>w.id===old.id);if(w){w.a={...old.a};w.b={...old.b};}}
 target.a={...a};target.b={...b};
 const pending=[id],processed=new Set();
 while(pending.length){const sourceId=pending.shift();if(processed.has(sourceId))continue;processed.add(sourceId);const oldSource=base.walls.find(w=>w.id===sourceId),newSource=f.walls.find(w=>w.id===sourceId);if(!oldSource||!newSource)continue;
  for(const old of base.walls){if(!phaseVisible(old)||old.id===id||old.id===sourceId)continue;const w=f.walls.find(w=>w.id===old.id);if(!w)continue;let moved=false;for(const end of['a','b']){const q=projection(old[end],oldSource);if(q.distance<.035){const next=onWall(newSource,q.offset/length(oldSource)*length(newSource));if(dist(next,w[end])>.0001){w[end]=next;moved=true;}}}if(moved)pending.push(w.id);}
 }
 if(f.roomMode==='manual'){
  for(const r of f.rooms){const original=base.rooms.find(q=>q.id===r.id);if(!original)continue;r.poly=original.poly.map(([x,y])=>{const p={x,y};let chosen=null,d=Infinity;for(const ow of base.walls){const nw=f.walls.find(q=>q.id===ow.id);if(!nw||dist(nw.a,ow.a)+dist(nw.b,ow.b)<.0001)continue;const q=projection(p,ow);if(q.distance<ow.thickness/2+.045&&q.distance<d){chosen={ow,nw,q};d=q.distance;}}if(!chosen)return[x,y];const {ow,nw,q}=chosen,np=onWall(nw,q.offset/length(ow)*length(nw)),angle=Math.atan2(nw.b.y-nw.a.y,nw.b.x-nw.a.x)-Math.atan2(ow.b.y-ow.a.y,ow.b.x-ow.a.x),dx=x-q.point.x,dy=y-q.point.y;return[np.x+dx*Math.cos(angle)-dy*Math.sin(angle),np.y+dx*Math.sin(angle)+dy*Math.cos(angle)];});}
 }
 normalizeOpenings(f);
}
export function refreshRooms(f){
 const activeRooms=f.rooms.filter(o=>phaseVisible(o)),preserved=f.roomMode==='manual'?activeRooms:activeRooms.filter(r=>r.manual);
 return [...preserved,...detectRooms(f).filter(r=>!preserved.some(old=>polygonsOverlap(r.poly,cleanRoomPolygon(old.poly))))];
}
export function missingRooms(f){return detectRooms(f).filter(r=>!f.rooms.filter(o=>phaseVisible(o)).some(old=>polygonsOverlap(r.poly,cleanRoomPolygon(old.poly))));}
export function manualRoom(f,points){
 const poly=points.map(p=>Array.isArray(p)?[...p]:[p.x,p.y]);checkRoomPolygon(poly,f.rooms.filter(o=>phaseVisible(o)));
 let n=1;while(f.rooms.some(r=>r.name===`手动分区 ${n}`))n++;
 return{id:uid(),name:`手动分区 ${n}`,mat:'tile800',poly:cleanRoomPolygon(poly),manual:true};
}
export function checkRoomEdit(f,room){checkRoomPolygon(room.poly,f.rooms.filter(o=>phaseVisible(o)),room.id);}
export function splitWall(f,id,p){
 const w=f.walls.find(w=>w.id===id);if(!w||w.structuralKind==='column')throw new Error('请点击需要断开的墙段');
 const q=projection(p,w),l=length(w);if(q.offset<.15||l-q.offset<.15)throw new Error('断开点离墙端太近，请点在墙段中间');
 if(f.openings.some(o=>o.wallId===id&&Math.abs(o.offset-q.offset)<o.width/2+.03))throw new Error('这里有门窗，请在门窗之外选择断开点');
 const next={...clone(w),id:uid(),a:{...q.point},inferred:false};w.b={...q.point};w.inferred=false;
 f.walls.splice(f.walls.indexOf(w)+1,0,next);
 f.openings.filter(o=>o.wallId===id&&o.offset>q.offset).forEach(o=>{o.wallId=next.id;o.offset-=q.offset;});
 return next;
}
export function connectWallEnds(f,first,second){
 const a=f.walls.find(w=>w.id===first.id),b=f.walls.find(w=>w.id===second.id);
 if(!a||!b||a.id===b.id||!['a','b'].includes(first.end)||!['a','b'].includes(second.end))throw new Error('请选择两面不同墙的端点');
 const p=a[first.end],q=b[second.end],gap=dist(p,q);if(gap<.035)throw new Error('这两个端点已经连接');
 const u={x:a.b.x-a.a.x,y:a.b.y-a.a.y},v={x:b.b.x-b.a.x,y:b.b.y-b.a.y},den=u.x*v.y-u.y*v.x;
 let points=[p,q];
 if(Math.abs(den)/(length(a)*length(b))>.25){
  const d={x:b.a.x-a.a.x,y:b.a.y-a.a.y},t=(d.x*v.y-d.y*v.x)/den,s=(d.x*u.y-d.y*u.x)/den,hit={x:a.a.x+t*u.x,y:a.a.y+t*u.y};
  const forwardA=first.end==='a'?t<=.001:t>=.999,forwardB=second.end==='a'?s<=.001:s>=.999;
  if(forwardA&&forwardB&&dist(p,hit)+dist(q,hit)<gap*2.5)points=[p,hit,q];
 }
 const added=[];for(let i=1;i<points.length;i++)if(dist(points[i-1],points[i])>=.01)added.push(wall(points[i-1],points[i],Math.min(a.thickness,b.thickness)));
 f.walls.push(...added);return added;
}
export function applyRecognition(f,result,{selectedIds,mode='replace-auto'}={}){
 const candidates=[...result.walls,...(result.reviewWalls||[])],selected=new Set(selectedIds??result.walls.map(w=>w.id));
 const picked=candidates.filter(w=>selected.has(w.id));
 if(!picked.length)throw new Error('请至少选中一条墙线或柱体');
 if(mode==='replace-auto'){
  const removed=new Set(f.walls.filter(w=>w.inferred).map(w=>w.id));
  f.walls=f.walls.filter(w=>!removed.has(w.id));
  f.openings=f.openings.filter(o=>!removed.has(o.wallId));
 }
 const wallIds=new Set(f.walls.map(w=>w.id)),openingIds=new Set(f.openings.map(o=>o.id));
 f.walls.push(...clone(picked.filter(w=>!wallIds.has(w.id))));
 f.openings.push(...clone(result.openings.filter(o=>selected.has(o.wallId)&&!openingIds.has(o.id))));
 normalizeOpenings(f);f.rooms=refreshRooms(f);
}
// Decompose a wall into non-overlapping solid rectangles around real openings.
export function wallCells(w,openings,defaultHeight){
 const l=length(w),h=w.height||defaultHeight,ops=openings.filter(o=>o.wallId===w.id);
 const xs=[0,l,...ops.flatMap(o=>[clamp(o.offset-o.width/2,0,l),clamp(o.offset+o.width/2,0,l)])].sort((a,b)=>a-b);const cells=[];
 for(let i=0;i<xs.length-1;i++){const a=xs[i],b=xs[i+1];if(b-a<.0001)continue;const cut=ops.filter(o=>o.offset-o.width/2<(a+b)/2&&o.offset+o.width/2>(a+b)/2).map(o=>[clamp(o.sill,0,h),clamp(o.sill+o.height,0,h)]).sort((a,b)=>a[0]-b[0]);let y=0;for(const[lo,hi]of cut){if(lo>y)cells.push({a,b,lo:y,hi:lo});y=Math.max(y,hi);}if(y<h)cells.push({a,b,lo:y,hi:h});}return cells;
}
// Planar half-edge traversal: split intersections first, then enumerate bounded faces.
export function detectRooms(f){
 const walls=roomBoundaryWalls(f.walls.filter(w=>phaseVisible(w))),splits=walls.map(w=>[0,1]);
 const cross=(a,b)=>a.x*b.y-a.y*b.x;
 for(let i=0;i<walls.length;i++)for(let j=i+1;j<walls.length;j++){const a=walls[i],b=walls[j],u={x:a.b.x-a.a.x,y:a.b.y-a.a.y},v={x:b.b.x-b.a.x,y:b.b.y-b.a.y},d={x:b.a.x-a.a.x,y:b.a.y-a.a.y},den=cross(u,v);if(Math.abs(den)>1e-8){const t=cross(d,v)/den,s=cross(d,u)/den;if(t>=-.005&&t<=1.005&&s>=-.005&&s<=1.005){splits[i].push(clamp(t,0,1));splits[j].push(clamp(s,0,1));}}else{for(const p of[b.a,b.b]){const q=projection(p,a);if(q.distance<.015)splits[i].push(q.offset/length(a));}for(const p of[a.a,a.b]){const q=projection(p,b);if(q.distance<.015)splits[j].push(q.offset/length(b));}}}
 const nodes=[],edges=[];const node=p=>{let i=nodes.findIndex(n=>dist(n,p)<.035);if(i<0){i=nodes.length;nodes.push({...p,out:[]});}return i;};
 walls.forEach((w,i)=>{const ts=[...new Set(splits[i].map(t=>Math.round(t*1e6)/1e6))].sort((a,b)=>a-b);for(let k=0;k<ts.length-1;k++){const a=node(onWall(w,ts[k]*length(w))),b=node(onWall(w,ts[k+1]*length(w)));if(a===b||edges.some(e=>e.a===a&&e.b===b))continue;const e=edges.length;edges.push({a,b,twin:e+1},{a:b,b:a,twin:e});nodes[a].out.push(e);nodes[b].out.push(e+1);}});
 nodes.forEach(n=>n.out.sort((a,b)=>Math.atan2(nodes[edges[a].b].y-n.y,nodes[edges[a].b].x-n.x)-Math.atan2(nodes[edges[b].b].y-n.y,nodes[edges[b].b].x-n.x)));
 const shapes=[],seen=new Set();for(let start=0;start<edges.length;start++){if(seen.has(start))continue;const trace=[];let e=start,closed=false;for(let step=0;step<=edges.length;step++){if(seen.has(e)){closed=e===start;break;}seen.add(e);const q=edges[e];trace.push([nodes[q.a].x,nodes[q.a].y]);const list=nodes[q.b].out,i=list.indexOf(q.twin);e=list[(i-1+list.length)%list.length];}if(closed&&signedArea(trace)>.45)shapes.push(cleanRoomPolygon(trace));}
 const rooms=[],used=new Set(),names=new Set(f.rooms.map(r=>r.name));
 for(const poly of shapes){
  const c=roomLabelPoint(poly),old=f.rooms.filter(r=>phaseVisible(r)&&!r.manual&&!used.has(r.id)).find(r=>{
   const q=roomLabelPoint(r.poly);return polygonContains([c.x,c.y],r.poly,true)&&polygonContains([q.x,q.y],poly,true);
  });
  if(old)used.add(old.id);let n=1;while(names.has(`房间 ${n}`))n++;const name=old?.name||`房间 ${n}`;names.add(name);
  rooms.push({...old,id:old?.id||uid(),name,mat:old?.mat||'wood',poly});
 }return rooms;
}
export function validateProject(input){
 const p=clone(input);if(p.version!==2||p.units!=='m'||!Array.isArray(p.floors)||!p.floors.length||p.floors.length>10)throw new Error('这不是有效的筑间项目文件');
 const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
 const point=q=>q&&finite(q.x,-500,500)&&finite(q.y,-500,500);
 if(p.scenes!=null&&(!Array.isArray(p.scenes)||p.scenes.length>50))throw new Error('最多保存 50 个场景');
 p.scenes=(p.scenes||[]).map(validateScene);if(new Set(p.scenes.map(s=>s.id)).size!==p.scenes.length)throw new Error('场景编号重复');
 p.name=String(p.name||'导入的建筑').slice(0,80);p.roof=['none','flat','gable','hip'].includes(p.roof)?p.roof:'none';const ids=new Set();
 for(const f of p.floors){if(typeof f.id!=='string'||!/^[a-zA-Z0-9_-]{1,90}$/.test(f.id)||ids.has(f.id)||!finite(f.height,2,8))throw new Error('楼层数据无效');ids.add(f.id);f.name=String(f.name||'楼层').slice(0,30);
  f.solids??=[];for(const k of['walls','openings','rooms','furniture','stairs','solids'])if(!Array.isArray(f[k])||f[k].length>2000)throw new Error('项目过大或数据不完整');
  const local=new Set();for(const k of['walls','openings','rooms','furniture','stairs','solids'])for(const o of f[k]){if(typeof o.id!=='string'||!/^[a-zA-Z0-9_-]{1,90}$/.test(o.id)||local.has(o.id))throw new Error('构件编号无效或重复');local.add(o.id);if(o.color&&!/^#[a-f0-9]{6}$/i.test(o.color))o.color='#dddcd0';}
  f.solids=f.solids.map(validateSolid);
  for(const w of f.walls){if(!point(w.a)||!point(w.b)||length(w)<.01||!finite(w.thickness,.03,1.5)||(w.height!=null&&!finite(w.height,.1,8)))throw new Error('墙体尺寸无效');}
  for(const o of f.openings){if(!f.walls.some(w=>w.id===o.wallId)||!['door','window'].includes(o.type)||!finite(o.offset,0,1000)||!finite(o.width,.1,100)||!finite(o.height,.1,8)||!finite(o.sill,0,8))throw new Error('门窗数据无效');o.hinge=o.hinge===-1?-1:1;if(o.swing!=null)o.swing=o.swing===-1?-1:1;}
  for(const r of f.rooms){if(!Array.isArray(r.poly)||r.poly.length<3||r.poly.length>1000||!r.poly.every(q=>Array.isArray(q)&&point({x:q[0],y:q[1]})))throw new Error('房间轮廓无效');r.name=String(r.name||'房间').slice(0,80);if(!['wood','walnut','tile800','tile600','marble','antislip','terrazzo','carpet'].includes(r.mat))r.mat='wood';}
  for(const [items,min] of [[f.furniture,.01],[f.stairs,.1]])for(const a of items){if(!point(a)||!finite(a.w,min,40)||!finite(a.d,min,40)||!finite(a.rot,-3600,3600))throw new Error('构件尺寸无效');}
  for(const a of f.furniture)if(a.z!=null&&!finite(a.z,-16,16))throw new Error('家具离地高度应为 -16–16 米');
  if(f.cad!=null){const c=f.cad;if(!Array.isArray(c.segments)||c.segments.length>12000||!c.segments.every(s=>s&&point(s.a)&&point(s.b))||typeof c.importId!=='string'||!/^[a-zA-Z0-9_-]{1,90}$/.test(c.importId)||!['mm','cm','m','in','ft'].includes(c.unit))throw new Error('CAD 参考线数据无效');c.name=String(c.name||'CAD 图纸').slice(0,120);c.hidden=!!c.hidden;}
  if(f.image){const i=f.image;if(!/^data:image\/(png|jpeg|webp);base64,/.test(i.data||'')||i.data.length>24e6||!point(i)||!finite(i.width,.1,500)||!finite(i.pixelWidth,1,10000)||!finite(i.pixelHeight,1,10000))throw new Error('底图无效');i.opacity=clamp(Number(i.opacity)||.5,.05,1);}
  for(const key of ['walls','openings','rooms','furniture','stairs','solids'])for(const o of f[key]){if(o.hidden!=null)o.hidden=!!o.hidden;if(o.locked!=null)o.locked=!!o.locked;if(o.groupId!=null){if(typeof o.groupId!=='string'||!/^[a-zA-Z0-9_-]{1,90}$/.test(o.groupId))throw new Error('组合编号无效');o.groupName=String(o.groupName||'组合').slice(0,80);}if(o.mirrorX!=null)o.mirrorX=!!o.mirrorX;}
  if(f.guides!=null&&(!Array.isArray(f.guides)||f.guides.length>500))throw new Error('参考线数据无效');
  for(const g of f.guides||[]){if(typeof g.id!=='string'||!/^[a-zA-Z0-9_-]{1,90}$/.test(g.id)||local.has(g.id)||!['x','y'].includes(g.axis)||!finite(g.value,-500,500))throw new Error('参考线数据无效');local.add(g.id);g.locked=!!g.locked;g.hidden=!!g.hidden;}
  normalizeOpenings(f);
 }normalizeEmptyFloorName(p);validateDelivery(p);
 if(p.delivery?.baseline){const baseline=clone(p.delivery.baseline),delivery={...p.delivery};delete delivery.baseline;validateProject({version:2,units:'m',name:'原始户型',roof:'none',floors:baseline.floors,delivery});}
 return p;
}
export function migrateLegacy(s){if(!Array.isArray(s.furniture))throw new Error('不支持的文件格式');const p=referenceProject(),f=p.floors[0];p.name='原项目 · 导入方案';f.furniture=s.furniture.map(o=>({id:uid(),type:o.type,name:o.name,x:o.cx/1000,y:o.cy/1000,w:o.w/1000,d:o.d/1000,rot:o.rot||0,color:o.color}));f.walls=f.walls.filter(w=>!(s.demolished||[]).includes(w.id.replace('original-wall-','w')));f.rooms.forEach(r=>Object.assign(r,{name:s.rooms?.[r.id]?.name||r.name,mat:s.rooms?.[r.id]?.mat||r.mat}));return validateProject(p);}
