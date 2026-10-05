import {ensureDelivery,phaseFloor,constructionStatus,phaseVisible} from './renovation.js';
import {furnitureMetrics} from './assets.js';

export const POINT_TYPES={socket:'插座',switch:'开关',light:'灯具',water:'给水',drain:'排水',floorDrain:'地漏',ac:'空调接口',heater:'热水器接口',data:'弱电接口'};
const uid=()=>crypto.randomUUID();
const len=w=>Math.hypot(w.b.x-w.a.x,w.b.y-w.a.y);
export function wallBasis(w){const length=len(w),ux=(w.b.x-w.a.x)/length,uy=(w.b.y-w.a.y)/length;return {length,ux,uy,nx:-uy,ny:ux};}
export function wallPoint(w,offset,side=0,extra=0){const b=wallBasis(w),n=side*(w.thickness/2+extra);return {x:w.a.x+b.ux*offset+b.nx*n,y:w.a.y+b.uy*offset+b.ny*n};}
export function wallCoordinates(w,p){const b=wallBasis(w),x=p.x-w.a.x,y=p.y-w.a.y;return {u:x*b.ux+y*b.uy,v:x*b.nx+y*b.ny};}
export function furnitureCorners(o){const a=o.rot*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return [[-o.w/2,-o.d/2],[o.w/2,-o.d/2],[o.w/2,o.d/2],[-o.w/2,o.d/2]].map(([x,y])=>({x:o.x+x*c-y*s,y:o.y+x*s+y*c}));}
export function resolvePoint(f,p){
 if(!f)return {error:'所在楼层不在此版图纸中'};
 if(!Number.isFinite(p.height)||p.height<0)return {error:'点位高度无效'};
 if(p.surface!=='wall'){if(p.height>f.height+.001)return {error:'点位超出楼层高度，请复核'};return {x:p.x,y:p.y,z:p.surface==='ceiling'?f.height-p.height:p.height};}
 const w=f.walls.find(w=>w.id===p.wallId);if(!w)return {error:'所属墙已不存在，请重新定位'};
 if(p.offset<0||p.offset>len(w)+.001)return {error:'点位超出墙长，请重新定位'};
 if(p.height>(w.height||f.height)+.001)return {error:'点位高于墙顶，请复核高度'};
 return {...wallPoint(w,p.offset,p.side,.018),z:p.height};
}
export function resolveAnchor(f,a){
 if(!f)return {error:'所在楼层不在此版图纸中'};
 if(!a)return {error:'缺少标注参照'};
 if(a.kind==='free')return {x:a.x,y:a.y,manual:true};
 if(a.kind==='wall'){const w=f.walls.find(w=>w.id===a.id);if(!w)return {error:'参照墙已变化'};const offset=a.point==='a'?0:a.point==='b'?len(w):a.offset||0;if(offset<0||offset>len(w)+.001)return {error:'参照位置超出墙长'};return wallPoint(w,offset,a.side||0,a.finish||0);}
 if(a.kind==='opening'){const o=f.openings.find(o=>o.id===a.id),w=o&&f.walls.find(w=>w.id===o.wallId);if(!w)return {error:'参照门窗已变化'};return wallPoint(w,o.offset+(a.point==='left'?-o.width/2:a.point==='right'?o.width/2:0),a.side||0);}
 if(a.kind==='furniture'){const o=f.furniture.find(o=>o.id===a.id);if(!o)return {error:'参照家具已变化'};const points=furnitureCorners(o),corner=['nw','ne','se','sw'].indexOf(a.point);if(corner>=0)return points[corner];const edge=['n','e','s','w'].indexOf(a.point);if(edge>=0){const b=points[(edge+1)%4];return {x:(points[edge].x+b.x)/2,y:(points[edge].y+b.y)/2};}return {x:o.x,y:o.y};}
 if(a.kind==='solid'){const o=f.solids.find(o=>o.id===a.id),p=o?.poly[a.index||0];return p?{x:p[0],y:p[1]}:{error:'参照构件轮廓已变化'};}
 if(a.kind==='point'){const p=f.delivery?.points.find(o=>o.id===a.id);return p?resolvePoint(f,p):{error:'参照点位已变化'};}
 return {error:'不支持的标注参照'};
}
export function anchorCandidates(f){
 const refs=[];for(const w of f.walls.filter(w=>!w.hidden))for(const point of ['a','b'])for(const side of [-1,0,1])refs.push({kind:'wall',id:w.id,point,side});
 for(const o of f.openings.filter(o=>!o.hidden))for(const point of ['left','right','center'])refs.push({kind:'opening',id:o.id,point});
 for(const o of f.furniture.filter(o=>!o.hidden))for(const point of ['nw','ne','se','sw','n','e','s','w','center'])refs.push({kind:'furniture',id:o.id,point});
 for(const o of (f.solids||[]).filter(o=>!o.hidden))o.poly.forEach((_,index)=>refs.push({kind:'solid',id:o.id,index}));
 for(const p of f.delivery?.points||[])refs.push({kind:'point',id:p.id});
 return refs.map(ref=>({ref,point:resolveAnchor(f,ref)})).filter(x=>!x.point.error);
}
export function nearestAnchor(f,p,threshold=.2){
 let best=null,d=threshold;for(const item of anchorCandidates(f)){const v=Math.hypot(item.point.x-p.x,item.point.y-p.y);if(v<d){d=v;best=item;}}
 // Keep precise corners and opening/furniture edges ahead of interior wall faces.
 if(d>.035)for(const w of f.walls.filter(w=>!w.hidden)){const q=wallCoordinates(w,p);if(q.u<=0||q.u>=len(w))continue;for(const side of [-1,1]){const ref={kind:'wall',id:w.id,offset:q.u,side},point=resolveAnchor(f,ref),distance=Math.hypot(point.x-p.x,point.y-p.y);if(distance<d){d=distance;best={ref,point};}}}
 return best||{ref:{kind:'free',x:p.x,y:p.y},point:{...p,manual:true}};
}
export function makeDimension(f,a,b,{axis='aligned',offset=.45,label='',phase='proposed'}={}){
 const x=resolveAnchor(f,a),y=resolveAnchor(f,b);if(x.error||y.error||Math.hypot(x.x-y.x,x.y-y.y)<.005)throw new Error('请选择两个不同的有效参照点');
 return {id:uid(),a:structuredClone(a),b:structuredClone(b),axis,offset,label:String(label).slice(0,80),phase,fallback:{a:x,b:y}};
}
export function dimensionValue(f,d){
 const a=resolveAnchor(f,d.a),b=resolveAnchor(f,d.b);if(a.error||b.error)return {error:a.error||b.error,a:d.fallback?.a,b:d.fallback?.b};
 const value=d.axis==='horizontal'?Math.abs(b.x-a.x):d.axis==='vertical'?Math.abs(b.y-a.y):Math.hypot(b.x-a.x,b.y-a.y);
 return {a,b,value,manual:!!(a.manual||b.manual)};
}
export function autoDimensions(project,floorId,phase='proposed'){
 ensureDelivery(project);const target=project.floors.find(f=>f.id===floorId),f=phaseFloor(project,floorId,phase),items=[];
 if(!f)throw new Error('本层不在所选阶段的图纸中');
 const all=f.walls.flatMap(w=>[w.a,w.b]),center={x:all.reduce((s,p)=>s+p.x,0)/(all.length||1),y:all.reduce((s,p)=>s+p.y,0)/(all.length||1)};
 for(const w of f.walls){if(w.structuralKind==='column')continue;const basis=wallBasis(w),outward=(((w.a.x+w.b.x)/2-center.x)*basis.nx+((w.a.y+w.b.y)/2-center.y)*basis.ny)>=0?1:-1;items.push(makeDimension(f,{kind:'wall',id:w.id,point:'a'},{kind:'wall',id:w.id,point:'b'},{phase,offset:.4*outward}));
  const ops=f.openings.filter(o=>o.wallId===w.id).sort((a,b)=>a.offset-b.offset);if(ops.length){const refs=[{kind:'wall',id:w.id,point:'a'},...ops.flatMap(o=>[{kind:'opening',id:o.id,point:'left'},{kind:'opening',id:o.id,point:'right'}]),{kind:'wall',id:w.id,point:'b'}];for(let i=1;i<refs.length;i++){const a=resolveAnchor(f,refs[i-1]),b=resolveAnchor(f,refs[i]);if(Math.hypot(a.x-b.x,a.y-b.y)>.005)items.push(makeDimension(f,refs[i-1],refs[i],{phase,offset:.85*outward}));}}
 }
 const ends=f.walls.flatMap(w=>['a','b'].map(point=>({kind:'wall',id:w.id,point,side:0})));for(const axis of ['horizontal','vertical']){const key=axis==='horizontal'?'x':'y',other=axis==='horizontal'?'y':'x',sign=axis==='horizontal'?1:-1,sorted=ends.toSorted((a,b)=>resolveAnchor(f,a)[key]-resolveAnchor(f,b)[key]);if(sorted.length>1){const lo=resolveAnchor(f,sorted[0])[key],hi=resolveAnchor(f,sorted.at(-1))[key],edge=v=>ends.filter(a=>Math.abs(resolveAnchor(f,a)[key]-v)<.001).sort((a,b)=>sign*(resolveAnchor(f,a)[other]-resolveAnchor(f,b)[other]))[0];if(hi-lo>.01)items.push(makeDimension(f,edge(lo),edge(hi),{phase,axis,offset:1.35,label:'总尺寸'}));}}
 const signature=d=>JSON.stringify([d.a,d.b,d.axis,d.phase]),known=new Set(target.delivery.dimensions.map(signature));let count=0;for(const d of items)if(!known.has(signature(d))){d.automatic=true;target.delivery.dimensions.push(d);known.add(signature(d));count++;}return count;
}
export function addServicePoint(project,floorId,type,location,options={}){
 if(!POINT_TYPES[type])throw new Error('请选择点位类型');ensureDelivery(project);const f=project.floors.find(f=>f.id===floorId);if(!f)throw new Error('楼层不存在');
 const surface=options.surface||(['light'].includes(type)?'ceiling':['floorDrain','drain'].includes(type)?'floor':'wall'),p={id:uid(),type,name:POINT_TYPES[type],surface,height:options.height??(surface==='ceiling'?0:surface==='floor'?0:type==='switch'?1.3:.3),side:options.side||1,controls:[],device:'',note:'',renovation:{status:'new'}};
 let number=1;while(f.delivery.points.some(o=>o.code==='P'+String(number).padStart(3,'0')))number++;p.code='P'+String(number).padStart(3,'0');
 if(surface==='wall'){
  let best=null;for(const w of f.walls.filter(w=>phaseVisible(w)&&!w.hidden)){const q=wallCoordinates(w,location),distance=Math.hypot(q.u-Math.max(0,Math.min(len(w),q.u)),q.v);if(!best||distance<best.distance)best={w,q,distance};}
  if(!best||best.distance>.8)throw new Error('请在要安装点位的墙面附近点击');p.wallId=best.w.id;p.offset=Math.max(0,Math.min(len(best.w),best.q.u));p.side=best.q.v<0?-1:1;
 }else Object.assign(p,{x:location.x,y:location.y});
 const resolved=resolvePoint(f,p);if(resolved.error)throw new Error(resolved.error);f.delivery.points.push(p);return p;
}
export function serviceWarnings(f){
 const issues=[];for(const p of f.delivery?.points||[]){if(!phaseVisible(p))continue;const pos=resolvePoint(f,p);if(pos.error){issues.push({id:p.id,message:`${p.code}：${pos.error}`});continue;}
  const w=p.wallId&&f.walls.find(w=>w.id===p.wallId);if(w&&!phaseVisible(w)){issues.push({id:p.id,message:`${p.code}：所属墙拟拆除，请迁移点位`});continue;}
  if(w&&f.openings.some(o=>o.wallId===w.id&&phaseVisible(o)&&Math.abs(o.offset-p.offset)<o.width/2&&pos.z>=o.sill&&pos.z<=o.sill+o.height))issues.push({id:p.id,message:`${p.code}：点位落在门窗洞口范围内`});
  for(const o of f.furniture.filter(o=>phaseVisible(o))){const a=-o.rot*Math.PI/180,x=(pos.x-o.x)*Math.cos(a)-(pos.y-o.y)*Math.sin(a),y=(pos.x-o.x)*Math.sin(a)+(pos.y-o.y)*Math.cos(a),metrics=furnitureMetrics(o),base=o.z??metrics.base;if(Math.abs(x)<o.w/2+.03&&Math.abs(y)<o.d/2+.03&&pos.z>=base&&pos.z<=base+(o.product?.height||metrics.height))issues.push({id:p.id,message:`${p.code}：可能被 ${o.code||o.name||'家具'} 遮挡，请核对安装位置`});}
  for(const target of p.controls||[])if(!f.delivery.points.some(q=>q.id===target&&q.type==='light'&&phaseVisible(q)))issues.push({id:p.id,message:`${p.code}：控制关系中的灯具已变化`});
 }return issues;
}
export function addElevation(project,floorId,wallId,{side=1,depth=1.2,name}={}){
 ensureDelivery(project);const f=project.floors.find(f=>f.id===floorId),w=f?.walls.find(w=>w.id===wallId);if(!w)throw new Error('请先选择一面墙');const e={id:uid(),wallId,side,depth,name:name||`${w.code||'墙体'} ${side===1?'A':'B'} 面立面`};f.delivery.elevations.push(e);return e;
}
export function elevationGeometry(f,e){
 const w=f.walls.find(w=>w.id===e.wallId);if(!w)return {error:'立面参照墙已不存在'};const basis=wallBasis(w),height=w.height||f.height,face=w.thickness/2,flip=u=>e.side===1?u:basis.length-u;
 const items=[];
 for(const o of f.openings.filter(o=>o.wallId===w.id&&phaseVisible(o)))items.push({id:o.id,kind:o.type,name:o.code||o.type,x:Math.min(flip(o.offset-o.width/2),flip(o.offset+o.width/2)),y:o.sill,w:o.width,h:o.height});
 for(const o of f.furniture.filter(o=>phaseVisible(o))){const corners=furnitureCorners(o).map(p=>wallCoordinates(w,p)),us=corners.map(p=>flip(p.u)),vs=corners.map(p=>p.v*e.side-face);if(Math.max(...vs)<-.02||Math.min(...vs)>e.depth||Math.max(...us)<0||Math.min(...us)>basis.length)continue;const metrics=furnitureMetrics(o);items.push({id:o.id,kind:'furniture',name:o.code||o.name||'家具',x:Math.max(0,Math.min(...us)),y:o.z??metrics.base,w:Math.min(basis.length,Math.max(...us))-Math.max(0,Math.min(...us)),h:o.product?.height||metrics.height});}
 for(const o of (f.solids||[]).filter(o=>phaseVisible(o))){const coords=o.poly.map(([x,y])=>wallCoordinates(w,{x,y})),us=coords.map(p=>flip(p.u)),vs=coords.map(p=>p.v*e.side-face);if(Math.max(...vs)<-.02||Math.min(...vs)>e.depth||Math.max(...us)<0||Math.min(...us)>basis.length)continue;items.push({id:o.id,kind:'solid',name:o.code||o.name,x:Math.max(0,Math.min(...us)),y:o.base,w:Math.min(basis.length,Math.max(...us))-Math.max(0,Math.min(...us)),h:o.height});}
 const points=[];for(const p of f.delivery?.points||[]){if(p.wallId!==w.id||p.side!==e.side||!phaseVisible(p))continue;const pos=resolvePoint(f,p);if(!pos.error)points.push({...p,x:flip(p.offset),y:p.height});}
 return {width:basis.length,height,wall:w,items,points};
}
export function addNote(project,floorId,anchor,text,{dx=.5,dy=-.5,phase='proposed'}={}){ensureDelivery(project);const note={id:uid(),anchor:structuredClone(anchor),text:String(text).trim().slice(0,1000),dx,dy,phase};if(!note.text)throw new Error('请输入说明文字');project.floors.find(f=>f.id===floorId).delivery.notes.push(note);return note;}
export function drawingIssues(project,floorId,phase='proposed'){
 const f=phaseFloor(project,floorId,phase),issues=[];if(!f)return issues;
 for(const d of f.delivery?.dimensions||[])if(!d.phase||d.phase===phase){const result=dimensionValue(f,d);if(result.error)issues.push({id:d.id,message:`尺寸 ${d.label||d.id.slice(0,6)}：${result.error}，待复核`});}
 for(const n of f.delivery?.notes||[]){const q=resolveAnchor(f,n.anchor);if(q.error)issues.push({id:n.id,message:`引注：${q.error}`});}
 if(phase==='proposed')for(const e of f.delivery?.elevations||[]){const q=elevationGeometry(f,e);if(q.error)issues.push({id:e.id,message:`${e.name}：${q.error}`});}
 return [...issues,...serviceWarnings(f)];
}
