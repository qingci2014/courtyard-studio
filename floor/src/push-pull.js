import * as M from './model.js';
import * as E from './editing.js';
import {validateSolid} from './modeling.js';
import {checkRoomPolygon} from './room-geometry.js';

const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]];
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const signedArea=p=>p.reduce((sum,a,i)=>sum+cross(a,p[(i+1)%p.length]),0)/2;
const near=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<1e-5;
const wallFrame=w=>{const length=M.length(w),u=[(w.b.x-w.a.x)/length,(w.b.y-w.a.y)/length];return {length,u,n:[-u[1],u[0]]};};
const edgeFrame=(poly,edge,hole=false)=>{
 const a=poly[edge],b=poly[(edge+1)%poly.length];if(!a||!b)throw new Error('这个面已改变，请重新选择');
 const d=sub(b,a),len=Math.hypot(...d),sign=Math.sign(signedArea(poly))*(hole?-1:1);
 return {a,b,u:d.map(v=>v/len),n:[sign*d[1]/len,-sign*d[0]/len]};
};
export const samePullFace=(a,b)=>!!a&&!!b&&a.type===b.type&&a.ring===b.ring&&a.edge===b.edge&&a.side===b.side&&a.end===b.end;

// Points and normals use the viewer's axes: X, height, plan Y, relative to this floor.
export function pullFaceInfo(floor,ref,face){
 const o=E.entity(floor,ref);if(!o||!face||!['wall','solid'].includes(ref.kind))return null;
 const h=o.height||floor.height,base=ref.kind==='solid'?o.base:0;
 if(face.type==='top'){
  const p=ref.kind==='wall'?{x:(o.a.x+o.b.x)/2,y:(o.a.y+o.b.y)/2}:M.roomLabelPoint(o.poly);
  return {normal:[0,1,0],point:[p.x,base+h,p.y],label:'顶面',dimension:h,dimensionLabel:'高度'};
 }
 if(ref.kind==='wall'){
  const {u,n,length}=wallFrame(o);
  if(face.type==='side'&&[1,-1].includes(face.side)){
   const normal=[n[0]*face.side,0,n[1]*face.side];
   return {normal,point:[(o.a.x+o.b.x)/2+normal[0]*o.thickness/2,h/2,(o.a.y+o.b.y)/2+normal[2]*o.thickness/2],label:'侧面',dimension:o.thickness,dimensionLabel:'墙厚'};
  }
  if(face.type==='end'&&['a','b'].includes(face.end)){
   const sign=face.end==='a'?-1:1,p=o[face.end];return {normal:[u[0]*sign,0,u[1]*sign],point:[p.x,h/2,p.y],label:'端面',dimension:length,dimensionLabel:'墙长'};
  }
 }else if(face.type==='side'&&Number.isInteger(face.ring)&&face.ring>=0){
  const poly=[o.poly,...(o.holes||[])][face.ring];if(!poly||!Number.isInteger(face.edge)||face.edge<0||face.edge>=poly.length)return null;
  const {a,b,n}=edgeFrame(poly,face.edge,face.ring>0);return {normal:[n[0],0,n[1]],point:[(a[0]+b[0])/2,base+h/2,(a[1]+b[1])/2],label:face.ring?'内侧面':'侧面'};
 }
 return null;
}

export function resolvePullFace(floor,ref,point,normal){
 const o=E.entity(floor,ref);if(!o||!['wall','solid'].includes(ref.kind))return null;
 const top=(o.height||floor.height)+(ref.kind==='solid'?o.base:0),p=[point[0],point[2]],tolerance=.003;
 if(normal[1]>.99&&Math.abs(point[1]-top)<tolerance)return {type:'top'};
 if(Math.abs(normal[1])>.01)return null;
 if(ref.kind==='wall'){
  const {u,n,length}=wallFrame(o),d=sub(p,[o.a.x,o.a.y]),normal2=[normal[0],normal[2]],across=dot(normal2,n),along=dot(normal2,u);
  if(Math.abs(across)>.99&&Math.abs(dot(d,n)-Math.sign(across)*o.thickness/2)<tolerance)return {type:'side',side:Math.sign(across)};
  if(along<-.99&&Math.abs(dot(d,u))<tolerance)return {type:'end',end:'a'};
  if(along>.99&&Math.abs(dot(d,u)-length)<tolerance)return {type:'end',end:'b'};
 }else{
  for(const [ring,poly] of [o.poly,...(o.holes||[])].entries())for(let edge=0;edge<poly.length;edge++){
   const {a,b,n,u}=edgeFrame(poly,edge,ring>0),d=sub(p,a),t=dot(d,u);
   if(dot(n,[normal[0],normal[2]])>.99&&Math.abs(dot(d,n))<tolerance&&t>=-tolerance&&t<=Math.hypot(...sub(b,a))+tolerance)return {type:'side',ring,edge};
  }
 }
 return null;
}

function moveSolidSide(solid,face,delta){
 const rings=[solid.poly,...solid.holes],poly=rings[face.ring],i=face.edge,next=(i+1)%poly.length,prev=(i+poly.length-1)%poly.length;
 const {a,b,n,u}=edgeFrame(poly,i,face.ring>0),p=[a[0]+n[0]*delta,a[1]+n[1]*delta];
 const intersect=(c,d)=>{const v=sub(d,c),den=cross(u,v);if(Math.abs(den)<1e-8)throw new Error('相邻边过于平行，请先调整轮廓');const t=cross(sub(c,p),v)/den;return [p[0]+u[0]*t,p[1]+u[1]*t];};
 const moved=poly.map(p=>[...p]);moved[i]=intersect(poly[prev],a);moved[next]=intersect(b,poly[(i+2)%poly.length]);
 // Reject collapsed or reversed edges before polygon cleanup can hide a topology change.
 for(let k=0;k<poly.length;k++){const old=sub(poly[(k+1)%poly.length],poly[k]),now=sub(moved[(k+1)%poly.length],moved[k]);if(dot(old,now)<=Math.hypot(...old)*.002)throw new Error('推拉距离过大，边界将交叉或消失');}
 if(signedArea(poly)*signedArea(moved)<=0)throw new Error('推拉距离过大，轮廓已翻转');
 rings[face.ring]=moved;solid.poly=rings[0];solid.holes=rings.slice(1);Object.assign(solid,validateSolid(solid));
}

function moveWallFace(floor,source,wall,face,delta){
 const original=source.walls.find(w=>w.id===wall.id),{u,n}=wallFrame(original),nodes=[];
 if(face.type==='side'){
  wall.thickness=original.thickness+delta;if(wall.thickness<.03-1e-8||wall.thickness>1.5+1e-8)throw new Error('墙厚应为 0.03–1.5 米');
  for(const end of ['a','b'])nodes.push({point:original[end],shift:{x:n[0]*face.side*delta/2,y:n[1]*face.side*delta/2}});
 }else{
  if(M.length(original)+delta<.03)throw new Error('墙长不能小于 0.03 米');
  const sign=face.end==='a'?-1:1;nodes.push({point:original[face.end],shift:{x:u[0]*sign*delta,y:u[1]*sign*delta}});
 }
 const endpoint=end=>{const shift=nodes.find(node=>near(node.point,original[end]))?.shift;return shift?{x:original[end].x+shift.x,y:original[end].y+shift.y}:{...original[end]};};
 // Reuse plan editing's connected-wall propagation, then restore openings so no
 // automatic clamping can silently shrink a door before the limits are checked.
 M.changeWall(floor,source,wall.id,endpoint('a'),endpoint('b'));floor.openings=M.clone(source.openings);
 const changed=new Set(floor.walls.filter(w=>{const old=source.walls.find(q=>q.id===w.id);return w.id===wall.id||!near(w.a,old.a)||!near(w.b,old.b);}).map(w=>w.id));
 for(const w of floor.walls.filter(w=>changed.has(w.id))){
  E.assertEditable(source,[{kind:'wall',id:w.id},...source.openings.filter(o=>o.wallId===w.id).map(o=>({kind:'opening',id:o.id}))]);
  const old=source.walls.find(q=>q.id===w.id),v=wallFrame(w);if(v.length<.03||dot(v.u,wallFrame(old).u)<=0)throw new Error('推拉距离过大，相连墙段将翻转');
  for(const opening of floor.openings.filter(o=>o.wallId===w.id)){
   if(w.id===wall.id&&face.type==='side')continue;
   const oldOpening=source.openings.find(o=>o.id===opening.id),p=M.onWall(old,oldOpening.offset);opening.offset=dot([p.x-w.a.x,p.y-w.a.y],v.u);
  }
 }
 for(const room of floor.rooms.filter(r=>floor.roomMode==='manual'||r.manual)){
  const old=source.rooms.find(r=>r.id===room.id);if(!old)continue;
  if(floor.roomMode!=='manual')room.poly=old.poly.map(([x,y])=>{
   let closest=null;for(const id of changed){const a=source.walls.find(w=>w.id===id),b=floor.walls.find(w=>w.id===id),q=M.projection({x,y},a);if(q.distance<a.thickness/2+.045&&(!closest||q.distance<closest.q.distance))closest={a,b,q};}
   if(!closest)return [x,y];const {a,b,q}=closest,p=M.onWall(b,q.offset/M.length(a)*M.length(b)),angle=Math.atan2(b.b.y-b.a.y,b.b.x-b.a.x)-Math.atan2(a.b.y-a.a.y,a.b.x-a.a.x),dx=x-q.point.x,dy=y-q.point.y;return [p.x+dx*Math.cos(angle)-dy*Math.sin(angle),p.y+dx*Math.sin(angle)+dy*Math.cos(angle)];
  });
  checkRoomPolygon(room.poly,[],undefined,{minArea:.0004,minEdge:.0005});
 }
 return changed;
}

export function applyPushPull(project,ref,face,delta){
 if(!Number.isFinite(delta)||Math.abs(delta)>100)throw new Error('推拉距离应在 -100 至 100 米之间');
 const next=M.clone(project),floor=next.floors.find(f=>f.id===ref.floorId),source=project.floors.find(f=>f.id===ref.floorId);
 if(!floor||!pullFaceInfo(floor,ref,face))throw new Error('请重新选择墙体或自建构件的面');
 E.assertEditable(source,[ref]);if(Math.abs(delta)<1e-9)return next;
 const object=E.entity(floor,ref);let affected=new Set();
 if(face.type==='top'){
  object.height=(object.height||floor.height)+delta;
  if(object.height<(ref.kind==='wall'?.1:.02)-1e-8||object.height>8+1e-8)throw new Error('推拉后的高度超出允许范围');
  if(ref.kind==='wall')affected.add(object.id);
 }else if(ref.kind==='solid')moveSolidSide(object,face,delta);
 else affected=moveWallFace(floor,source,object,face,delta);
 for(const w of floor.walls.filter(w=>affected.has(w.id)))for(const o of floor.openings.filter(o=>o.wallId===w.id)){
  if(o.offset-o.width/2<-.00001||o.offset+o.width/2>M.length(w)+.00001||(o.sill||0)+o.height>(w.height||floor.height)+.00001)throw new Error('推拉会挤到门窗，请先调整门窗或减小距离');
 }
 if(ref.kind==='wall'&&face.type!=='top')floor.rooms=M.refreshRooms(floor);
 E.assertLocksPreserved(project,next);return M.validateProject(next);
}
