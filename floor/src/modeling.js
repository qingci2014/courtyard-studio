import Clipper from 'clipper-lib';
import {furnitureMetrics} from './assets.js';
import {cleanRoomPolygon,checkRoomPolygon,polygonArea,polygonContains,polygonsOverlap} from './room-geometry.js';

const SCALE=100000;
const finite=(n,a,b)=>typeof n==='number'&&Number.isFinite(n)&&n>=a&&n<=b;
const intPath=poly=>poly.map(([x,y])=>({X:Math.round(x*SCALE),Y:Math.round(y*SCALE)}));
const floatPath=path=>path.map(p=>[p.X/SCALE,p.Y/SCALE]);
export const solidArea=o=>polygonArea(o.poly)-(o.holes||[]).reduce((a,p)=>a+polygonArea(p),0);
export function solidContour(points){
 if(!Array.isArray(points)||points.length>500||points.some(p=>!Array.isArray(p)||p.length!==2||p.some(n=>!finite(n,-500,500))))throw new Error('构件轮廓无效');
 const poly=cleanRoomPolygon(points);checkRoomPolygon(poly,[],undefined,{minArea:.0004,minEdge:.0005});return poly;
}
export function validateSolid(o){
 if(!o||!finite(o.height,.02,8)||!finite(o.base,0,16))throw new Error('构件高度应为 0.02–8 米，离地高度应为 0–16 米');
 const poly=solidContour(o.poly);if(o.holes!=null&&(!Array.isArray(o.holes)||o.holes.length>50))throw new Error('构件内部轮廓无效');
 const holes=(o.holes||[]).map(solidContour);
 for(let i=0;i<holes.length;i++){
  const hole=holes[i];if(!hole.every(p=>polygonContains(p,poly,true)))throw new Error('内部轮廓必须位于构件内');
  const clip=new Clipper.Clipper(),outside=[];clip.AddPath(intPath(hole),Clipper.PolyType.ptSubject,true);clip.AddPath(intPath(poly),Clipper.PolyType.ptClip,true);clip.Execute(Clipper.ClipType.ctDifference,outside,Clipper.PolyFillType.pftNonZero,Clipper.PolyFillType.pftNonZero);
  if(outside.some(p=>Math.abs(Clipper.Clipper.Area(p))/SCALE**2>1e-7))throw new Error('内部轮廓穿过构件边界');
  if(holes.slice(0,i).some(other=>polygonsOverlap(hole,other)))throw new Error('内部轮廓不能互相重叠');
 }
 if(polygonArea(poly)-holes.reduce((sum,h)=>sum+polygonArea(h),0)<.0004)throw new Error('构件边框太窄');
 return {...o,poly,holes,name:String(o.name||'自建构件').slice(0,80),color:/^#[a-f0-9]{6}$/i.test(o.color||'')?o.color:'#c9bea6'};
}
export function makeSolid(points,{name='自建构件',height=1,base=0,color='#c9bea6',holes=[]}={}){
 return validateSolid({id:crypto.randomUUID(),name,poly:points.map(p=>Array.isArray(p)?p:[p.x,p.y]),holes,height,base,color});
}
export function rectangleContour(a,b){
 if(Math.abs(a.x-b.x)<.02||Math.abs(a.y-b.y)<.02)throw new Error('请画出至少 2 厘米宽的矩形');
 return [[Math.min(a.x,b.x),Math.min(a.y,b.y)],[Math.max(a.x,b.x),Math.min(a.y,b.y)],[Math.max(a.x,b.x),Math.max(a.y,b.y)],[Math.min(a.x,b.x),Math.max(a.y,b.y)]];
}
export function insetContour(points,distance){
 if(!finite(distance,.005,5))throw new Error('偏移宽度应为 0.005–5 米');
 const outer=solidContour(points),path=intPath(outer);if(!Clipper.Clipper.Orientation(path))path.reverse();
 const offset=new Clipper.ClipperOffset(2,.001*SCALE),paths=[];offset.AddPath(path,Clipper.JoinType.jtMiter,Clipper.EndType.etClosedPolygon);offset.Execute(paths,-distance*SCALE);
 const inner=paths.map(floatPath).filter(p=>polygonArea(p)>=.0004).map(solidContour);
 if(!inner.length)throw new Error('偏移宽度过大，内部轮廓已消失，请减小宽度');
 return {outer,inner};
}
export function offsetSolid(points,{distance=.15,height=.2,base=0,name='平台边框',color='#c9bea6'}={}){
 const {outer,inner}=insetContour(points,distance);return makeSolid(outer,{height,base,name,color,holes:inner});
}
export function sceneBounds(project,{exploded=false,roofVisible=true}={}){
 let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity,top=0,elevation=0;
 project.floors.forEach((f,index)=>{
  const base=elevation+(exploded?index*2.3:0);let floorX0=Infinity,floorX1=-Infinity;
  const point=([x,y])=>{x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);floorX0=Math.min(floorX0,x);floorX1=Math.max(floorX1,x);};
  for(const w of f.walls){point([w.a.x,w.a.y]);point([w.b.x,w.b.y]);top=Math.max(top,base+(w.height||f.height));}
  for(const r of f.rooms)r.poly.forEach(point);
  for(const s of f.solids||[]){s.poly.forEach(point);top=Math.max(top,base+s.base+s.height);}
  for(const o of f.furniture){point([o.x-o.w/2,o.y-o.d/2]);point([o.x+o.w/2,o.y+o.d/2]);const metrics=furnitureMetrics(o);top=Math.max(top,base+(o.z??metrics.base)+metrics.height);}
  if(index===project.floors.length-1&&roofVisible&&project.roof!=='none'&&f.walls.length)top=Math.max(top,base+f.height+.04+(project.roof==='flat'?.18:Math.min(2.8,(Math.max(.5,floorX1-floorX0)+.6)*.25)));
  for(const o of f.stairs){point([o.x-o.w/2,o.y-o.d/2]);point([o.x+o.w/2,o.y+o.d/2]);top=Math.max(top,base+f.height+.93);}
  elevation+=f.height;top=Math.max(top,base+f.height);
 });
 if(!Number.isFinite(x0)){x0=0;x1=12;y0=0;y1=10;}
 return {x:[x0-.5,x1+.5],y:[y0-.5,y1+.5],height:[0,top+.5]};
}
export function normalizeSection(section={}){
 return {axis:['x','y','height'].includes(section.axis)?section.axis:'height',position:finite(section.position,-500,500)?section.position:1.4,flipped:!!section.flipped,showPlane:section.showPlane!==false};
}
export function sectionEquation(section){
 const s=normalizeSection(section),sign=s.flipped?1:-1,normal=s.axis==='height'?[0,sign,0]:s.axis==='x'?[sign,0,0]:[0,0,sign];return {normal,constant:-sign*s.position};
}
export function projectedDragDelta(dx,dy,axisX,axisY){const square=axisX*axisX+axisY*axisY;return square>1e-8?(dx*axisX+dy*axisY)/square:0;}
export function validateScene(scene){
 const vector=v=>Array.isArray(v)&&v.length===3&&v.every(n=>finite(n,-5000,5000));
 if(!scene||typeof scene.id!=='string'||!/^[\w-]{1,90}$/.test(scene.id)||!vector(scene.camera?.position)||!vector(scene.camera?.target)||Math.hypot(...scene.camera.position.map((n,i)=>n-scene.camera.target[i]))<.01)throw new Error('保存的视角无效');
 const s=structuredClone(scene);s.name=String(s.name||'场景').slice(0,80);s.view=s.view||{};
 s.view.mode=['2d','split','3d'].includes(s.view.mode)?s.view.mode:'3d';s.view.show=s.view.show==='current'?'current':'all';s.view.floorId=String(s.view.floorId||'');s.view.section=normalizeSection(s.view.section);
 for(const key of ['exploded','cut','night'])s.view[key]=!!s.view[key];for(const key of ['furniture','blueprint','roofVisible'])s.view[key]=s.view[key]!==false;
 if(s.plan&&(!finite(s.plan.x,-2000,2000)||!finite(s.plan.y,-2000,2000)||!finite(s.plan.w,.1,2000)||!finite(s.plan.h,.1,2000)))throw new Error('保存的平面视角无效');
 if(s.visibility!=null&&(!Array.isArray(s.visibility)||s.visibility.length>100000))throw new Error('场景显示状态无效');
 s.visibility=(s.visibility||[]).map(v=>{if(!v||typeof v.floorId!=='string'||typeof v.id!=='string'||!['wall','opening','room','solid','furniture','stair','image'].includes(v.kind))throw new Error('场景显示状态无效');return {floorId:v.floorId,id:v.id,kind:v.kind,hidden:!!v.hidden};});return s;
}
