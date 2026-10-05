import Clipper from 'clipper-lib';
import {phaseFloor,constructionStatus,ensureDelivery,revisionLabel} from './renovation.js';
import {wallBasis,wallPoint,furnitureCorners,POINT_TYPES,resolvePoint} from './delivery-model.js';
import {polygonArea,polygonContains} from './room-geometry.js';

const SCALE=100000;
const toInt=p=>p.map(([x,y])=>({X:Math.round(x*SCALE),Y:Math.round(y*SCALE)}));
const fromInt=p=>p.map(q=>[q.X/SCALE,q.Y/SCALE]);
const pathsArea=paths=>Math.abs(paths.reduce((s,p)=>s+Clipper.Clipper.Area(p),0))/SCALE**2;
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const oriented=p=>{const path=toInt(p);if(!Clipper.Clipper.Orientation(path))path.reverse();return path;};
function difference(subject,clips){const c=new Clipper.Clipper(),out=[];c.AddPaths(subject.map(oriented),Clipper.PolyType.ptSubject,true);if(clips.length)c.AddPaths(clips.map(oriented),Clipper.PolyType.ptClip,true);c.Execute(Clipper.ClipType.ctDifference,out,Clipper.PolyFillType.pftNonZero,Clipper.PolyFillType.pftNonZero);return out;}
function union(paths){if(!paths.length)return [];const c=new Clipper.Clipper(),out=[];c.AddPaths(paths.map(oriented),Clipper.PolyType.ptSubject,true);c.Execute(Clipper.ClipType.ctUnion,out,Clipper.PolyFillType.pftNonZero,Clipper.PolyFillType.pftNonZero);return out;}
export function wallFootprint(w){const b=wallBasis(w),n=w.thickness/2;return [[w.a.x+b.nx*n,w.a.y+b.ny*n],[w.b.x+b.nx*n,w.b.y+b.ny*n],[w.b.x-b.nx*n,w.b.y-b.ny*n],[w.a.x-b.nx*n,w.a.y-b.ny*n]];}
export function netRoomGeometry(project,floorId,roomId){
 const f=phaseFloor(project,floorId,'proposed'),room=f?.rooms.find(r=>r.id===roomId);if(!room)return {error:'房间边界已变化，请重新选择'};
 const clips=f.walls.map(wallFootprint);
 for(const o of f.solids||[])if(o.usage==='column'&&o.base<.05)clips.push(o.poly);
 const index=project.floors.findIndex(q=>q.id===floorId),below=index>0?phaseFloor(project,project.floors[index-1].id,'proposed'):null;
 if(below)for(const stair of below.stairs)clips.push(furnitureCorners(stair).map(p=>[p.x,p.y]));
 const paths=difference([room.poly],clips),gross=polygonArea(room.poly),net=pathsArea(paths),contours=paths.map(fromInt);
 const perimeter=contours.reduce((s,p)=>s+p.reduce((t,a,i)=>{const b=p[(i+1)%p.length];return t+Math.hypot(b[0]-a[0],b[1]-a[1]);},0),0);
 let doorDeduction=0;
 for(const path of contours)for(let i=0;i<path.length;i++){
  const a=path[i],b=path[(i+1)%path.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<.0001)continue;
  const intervals=[];
  for(const o of f.openings.filter(o=>o.type==='door'&&o.sill<.02)){
   const w=f.walls.find(w=>w.id===o.wallId),basis=wallBasis(w),dx=(b[0]-a[0])/length,dy=(b[1]-a[1])/length;
   if(Math.abs(dx*basis.nx+dy*basis.ny)>.002)continue;
   const distance=Math.abs((a[0]-w.a.x)*basis.nx+(a[1]-w.a.y)*basis.ny);if(Math.abs(distance-w.thickness/2)>.025)continue;
   const left=wallPoint(w,o.offset-o.width/2),right=wallPoint(w,o.offset+o.width/2),u=(left.x-a[0])*dx+(left.y-a[1])*dy,v=(right.x-a[0])*dx+(right.y-a[1])*dy,lo=Math.max(0,Math.min(u,v)),hi=Math.min(length,Math.max(u,v));if(hi>lo)intervals.push([lo,hi]);
  }
  intervals.sort((a,b)=>a[0]-b[0]);let end=-Infinity;for(const [lo,hi] of intervals){doorDeduction+=Math.max(0,hi-Math.max(lo,end));end=Math.max(end,hi);}
 }
 return {room,gross,net,deduction:Math.max(0,gross-net),contours,perimeter,doorDeduction,skirting:Math.max(0,perimeter-doorDeduction),basis:room.manual?'手工分区边界扣墙体及柱体 / 楼梯洞口':'墙中线边界扣墙体及柱体 / 楼梯洞口'};
}
export function wallFinishGeometry(f,finish){
 const w=f.walls.find(o=>o.id===finish.targetId);if(!w)return {error:'饰面参照墙已变化'};
 const length=wallBasis(w).length,x=finish.start||0,X=finish.end??length,y=finish.bottom||0,Y=finish.top??(w.height||f.height);
 if(x<0||X>length+.001||X<=x||Y<=y||Y>(w.height||f.height)+.001)return {error:'饰面分区超出墙体或范围为空，请复核'};
 const holes=f.openings.filter(o=>o.wallId===w.id).map(o=>{const lo=Math.max(x,o.offset-o.width/2),hi=Math.min(X,o.offset+o.width/2),bottom=Math.max(y,o.sill),top=Math.min(Y,o.sill+o.height);return hi>lo&&top>bottom?rect(lo,bottom,hi-lo,top-bottom):null;}).filter(Boolean);
 const gross=(X-x)*(Y-y),deduction=pathsArea(union(holes)),net=gross-deduction;
 return {wall:w,x,X,y,Y,gross,deduction,net,contours:difference([rect(x,y,X-x,Y-y)],holes).map(fromInt),openings:f.openings.filter(o=>o.wallId===w.id).map(o=>o.id)};
}
export function addFinish(project,floorId,{surface,targetId,side=1,name='涂料',spec='',work='饰面施工',start=0,end=null,bottom=0,top=null,color='#dfdad2'}={}){
 ensureDelivery(project);const f=project.floors.find(f=>f.id===floorId),item={id:crypto.randomUUID(),surface,targetId,side,name:String(name).slice(0,100),spec:String(spec).slice(0,100),work:String(work).slice(0,100),start,end,bottom,top,color};
 if(surface==='wall'){const g=wallFinishGeometry(phaseFloor(project,floorId),item);if(g.error)throw new Error(g.error);const other=f.delivery.finishes.filter(v=>v.surface==='wall'&&v.targetId===targetId&&v.side===side&&v.work===work);for(const o of other){const q=wallFinishGeometry(f,o);if(!q.error&&Math.min(g.X,q.X)>Math.max(g.x,q.x)+.001&&Math.min(g.Y,q.Y)>Math.max(g.y,q.y)+.001)throw new Error('同一墙面、同一施工项目的饰面分区重叠，请调整范围');}}
 else if(!f.rooms.some(r=>r.id===targetId))throw new Error('请选择房间');
 else if(f.delivery.finishes.some(v=>v.surface===surface&&v.targetId===targetId&&v.work===work))throw new Error('该房间已有同类施工项目，请修改原记录');
 f.delivery.finishes.push(item);return item;
}
export function updateFinish(project,floorId,id,values){
 const f=project.floors.find(f=>f.id===floorId),index=f?.delivery?.finishes.findIndex(x=>x.id===id);if(index==null||index<0)throw new Error('饰面记录已变化');
 const probe=structuredClone(project),target=probe.floors.find(f=>f.id===floorId),old=target.delivery.finishes.splice(index,1)[0],replacement=addFinish(probe,floorId,{...old,...values});replacement.id=id;f.delivery.finishes[index]=replacement;return replacement;
}
export function quantityRows(project){
 const rows=[],warnings=[];
 const add=row=>{
  const q=project.delivery?.quotes?.[row.key]||{},loss=q.loss||0,base=q.override??row.net,quantity=base*(1+loss/100),unitPrice=q.unitPrice??row.defaultPrice??0,labor=q.labor??row.defaultLabor??0;
  rows.push({...row,loss,override:q.override??null,reason:q.reason||'',quantity,unitPrice,labor,amount:Math.round(quantity*(unitPrice+labor)*100)/100});
 };
 const floorIds=[...new Set([...project.floors,...(project.delivery?.baseline?.floors||[])].map(f=>f.id))];
 for(const floorId of floorIds){const original=project.floors.find(f=>f.id===floorId)||phaseFloor(project,floorId,'demolition'),f=phaseFloor(project,floorId)||{...original,walls:[],rooms:[],openings:[],furniture:[],solids:[],delivery:null},finishes=f.delivery?.finishes||[];
  for(const room of f.rooms){const g=netRoomGeometry(project,f.id,room.id);if(g.error){warnings.push(g.error);continue;}if(!finishes.some(x=>x.surface==='floor'&&x.targetId===room.id))add({key:`${f.id}:floor:${room.id}`,floorId:f.id,room:room.name,name:'净地面（未选材）',category:'地面',unit:'m²',gross:g.gross,deduction:g.deduction,net:g.net,refs:[{kind:'room',id:room.id}],formula:g.basis,phase:'proposed'});}
  for(const item of finishes){
   const wall=item.surface==='wall',g=wall?wallFinishGeometry(f,item):netRoomGeometry(project,f.id,item.targetId);
   if(g.error){warnings.push(`${item.name}：${g.error}`);continue;}
   const skirting=item.surface==='skirting',gross=skirting?g.perimeter:g.gross,deduction=skirting?g.doorDeduction:g.deduction,net=skirting?g.skirting:g.net;
   add({key:`${f.id}:finish:${item.id}`,floorId:f.id,finishId:item.id,room:wall?(item.roomName||g.wall.code||'墙面'):g.room.name,name:item.name,spec:item.spec,category:item.work,unit:skirting?'m':'m²',gross,deduction,net,refs:[{kind:wall?'wall':'room',id:item.targetId}],side:item.side,phase:'proposed',formula:wall?`${(g.X-g.x).toFixed(3)} × ${(g.Y-g.y).toFixed(3)} - 门窗交集（不含洞口侧面）`:skirting?'净边界周长 - 落地门洞宽度':g.basis});
  }
  for(const w of original.walls){const status=constructionStatus(w);if(status==='existing')continue;const local={...original,openings:original.openings.filter(o=>o.wallId===w.id)},g=wallFinishGeometry(local,{targetId:w.id,start:0,bottom:0});if(g.error)continue;add({key:`${f.id}:construction:${w.id}`,floorId:f.id,room:w.code||'墙体',name:status==='demolish'?'墙体拆除':'新建墙体',category:'拆改',unit:'m²',gross:g.gross,deduction:g.deduction,net:g.net,phase:status==='demolish'?'demolition':'proposed',refs:[{kind:'wall',id:w.id}],formula:`墙长 × 墙高 - 洞口；墙厚 ${Math.round(w.thickness*1000)} mm`});}
  for(const [list,kind,label] of [['openings','opening','门窗'],['furniture','furniture','家具'],['solids','solid','自建构件']])for(const o of f[list]||[])add({key:`${f.id}:${kind}:${o.id}`,floorId:f.id,room:o.code||'',name:o.product?.name||o.name||(o.type==='door'?'门':o.type==='window'?'窗':label),spec:o.product?.model||'',category:label,unit:'件',gross:1,deduction:0,net:1,defaultPrice:constructionStatus(o)==='new'?o.product?.unitPrice||0:0,phase:'proposed',refs:[{kind,id:o.id}],formula:constructionStatus(o)==='new'?'拟新建 / 采购数量':'现状保留数量，默认单价为 0'});
  for(const p of f.delivery?.points||[]){const location=resolvePoint(f,p);if(location.error){warnings.push(`${p.code}：${location.error}，未计入点位数量`);continue;}add({key:`${f.id}:point:${p.id}`,floorId:f.id,room:p.code,name:POINT_TYPES[p.type]||p.type,spec:p.device||'',category:'水电点位',unit:'个',gross:1,deduction:0,net:1,phase:'proposed',refs:[{kind:'point',id:p.id}],formula:'按有效点位计数，不含配线、配管和回路容量'});}
 }
 for(const item of project.delivery?.manualRows||[])add({key:'manual:'+item.id,floorId:item.floorId||project.floors[0].id,room:item.room||'',name:item.name||'人工项目',spec:item.note||'',category:'人工补充',unit:item.unit||'项',gross:item.quantity,deduction:0,net:item.quantity,defaultPrice:item.unitPrice,defaultLabor:item.labor||0,refs:[],phase:'proposed',formula:'人工录入：'+(item.reason||'补充施工项目')});
 return {rows,warnings,total:Math.round(rows.reduce((s,r)=>s+r.amount,0)*100)/100};
}
export function setQuote(project,key,values){
 const d=ensureDelivery(project),q={...d.quotes[key],...values};for(const name of ['loss','unitPrice','labor'])if(q[name]!=null&&(!Number.isFinite(q[name])||q[name]<0||q[name]>(name==='loss'?500:1e8)))throw new Error('请输入有效的非负损耗和单价');if(q.override!=null&&(!Number.isFinite(q.override)||q.override<0||!String(q.reason||'').trim()))throw new Error('修正数量时需填写原因');d.quotes[key]=q;
}
const csvCell=v=>'"'+String(v??'').replace(/^[=+\-@\t\r]/,c=>"'"+c).replaceAll('"','""')+'"';
export function quantitiesCSV(project){const {rows,total}=quantityRows(project),lines=[['项目',project.name,'版本',revisionLabel(project),'尺寸依据',project.delivery?.source||'estimated'],['楼层','房间 / 构件','类别','材料 / 项目','规格','单位','原始数量','扣除数量','净数量','修正数量','修正原因','损耗 %','计价数量','材料单价','人工单价','合价','计算依据','来源编号']];for(const r of rows)lines.push([phaseFloor(project,r.floorId,r.phase)?.name,r.room,r.category,r.name,r.spec,r.unit,r.gross.toFixed(4),r.deduction.toFixed(4),r.net.toFixed(4),r.override??'',r.reason,r.loss,r.quantity.toFixed(4),r.unitPrice,r.labor,r.amount,r.formula,r.refs.map(q=>q.id).join(' / ')]);lines.push(['合计','','','','','','','','','','','','','','',total]);return '\uFEFF'+lines.map(row=>row.map(csvCell).join(',')).join('\r\n');}
