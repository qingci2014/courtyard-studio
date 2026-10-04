import DxfParser from 'dxf-parser';
import {uid,wall,length,clone,refreshRooms,validateProject} from './model.js';

export const CAD_UNITS={mm:{name:'毫米',scale:.001,code:4},cm:{name:'厘米',scale:.01,code:5},m:{name:'米',scale:1,code:6},in:{name:'英寸',scale:.0254,code:1},ft:{name:'英尺',scale:.3048,code:2}};
const MAX_SEGMENTS=24000,EPS=1e-7;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const dot=(p,u)=>p.x*u.x+p.y*u.y;
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const point=(m,p)=>({x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]});
const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
export function cadBounds(segments){
 let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;
 for(const s of segments)for(const p of [s.a,s.b]){x=Math.min(x,p.x);y=Math.min(y,p.y);right=Math.max(right,p.x);bottom=Math.max(bottom,p.y);}
 return Number.isFinite(x)?{x,y,w:right-x,h:bottom-y}:null;
}
export function decodeDxf(buffer){
 const bytes=new Uint8Array(buffer),header=new TextDecoder('windows-1252').decode(bytes.subarray(0,65536));
 if(header.startsWith('AutoCAD Binary DXF'))throw new Error('这是二进制 DXF，请在 CAD 中另存为 ASCII DXF 后导入。');
 const codepage=header.match(/\$DWGCODEPAGE\s*\r?\n\s*3\s*\r?\n\s*ANSI_(\d+)/)?.[1],version=header.match(/\$ACADVER\s*\r?\n\s*1\s*\r?\n\s*AC(\d+)/)?.[1];
 const enc=Number(version)>=1021?'utf-8':({936:'gbk',950:'big5',932:'shift_jis',949:'euc-kr',1252:'windows-1252'}[codepage]||'utf-8');
 return new TextDecoder(enc).decode(bytes);
}
export function parseCAD(text){
 if(typeof text!=='string'||text.length>30*1024*1024)throw new Error('DXF 请控制在 30 MB 以内。');
 if(text.startsWith('AutoCAD Binary DXF'))throw new Error('请另存为 ASCII DXF 后导入。');
 if(!/\bSECTION\b/.test(text)||!/(?:^|\n)\s*0\s*\r?\n\s*EOF\s*$/.test(text))throw new Error('DXF 不完整或格式无效，请从 CAD 重新另存为 DXF。');
 let doc;try{doc=new DxfParser().parseSync(text.replace(/^\uFEFF/,''));}catch{throw new Error('无法读取此 DXF，请从 CAD 另存为 ASCII DXF（建议 2010 或更新版本）。');}
 const segments=[],warnings=new Set(),layerInfo=doc.tables?.layer?.layers||{},layers=new Map();let visited=0,ignored=0;
 const emit=(a,b,entity,m,layer,curve=false,width=0)=>{
  if(!a||!b||![a.x,a.y,b.x,b.y].every(Number.isFinite))throw new Error('图纸中存在无效坐标。');
  const sourceLength=distance(a,b);a=point(m,a);b=point(m,b);a.y=-a.y;b.y=-b.y;
  if(distance(a,b)<EPS)return;
  if(segments.length>=MAX_SEGMENTS)throw new Error('图纸线段过多，请在 CAD 中只保留所需楼层，或拆分文件后导入。');
  const l=Object.hasOwn(layerInfo,layer)?layerInfo[layer]:{};
  if(!layers.has(layer))layers.set(layer,{name:layer,count:0,visible:l.visible!==false&&!l.frozen,recommended:/wall|墙|结构|partition/i.test(layer)&&!/dim|标注|轴|axis|grid/i.test(layer)});
  const scale=Math.abs(m[0]*m[3]-m[1]*m[2])*sourceLength/distance(a,b);
  segments.push({a,b,layer,curve,width:width*scale});layers.get(layer).count++;
 };
 const arc=(center,radius,start,sweep,entity,m,layer)=>{
  if(!Number.isFinite(radius)||radius<=0)return;
  const n=Math.max(2,Math.ceil(Math.abs(sweep)/(Math.PI/36)));
  for(let i=0;i<n;i++){const p=t=>({x:center.x+radius*Math.cos(t),y:center.y+radius*Math.sin(t)});emit(p(start+sweep*i/n),p(start+sweep*(i+1)/n),entity,m,layer,true);}
 };
 const visit=(entities,m=[1,0,0,1,0,0],inherited='0',chain=[])=>{
  for(const e of entities||[]){
   if(++visited>100000)throw new Error('图纸构件过多，请拆分楼层后导入。');
   if(e.inPaperSpace||e.visible===false)continue;
   const layer=e.layer&&e.layer!=='0'?e.layer:inherited;
   const normal=e.extrusionDirection||{x:e.extrusionDirectionX||0,y:e.extrusionDirectionY||0,z:e.extrusionDirectionZ??1};
   if(Math.abs(normal.x||0)>EPS||Math.abs(normal.y||0)>EPS||Math.abs((normal.z??1)-1)>EPS){warnings.add('有非标准平面方向的构件未导入，请先在 CAD 中转为世界 XY 平面。');continue;}
   if(e.type==='INSERT'){
    if(chain.includes(e.name)||chain.length>=12){warnings.add('递归或嵌套过深的图块已跳过。');continue;}
    const block=Object.hasOwn(doc.blocks||{},e.name)?doc.blocks[e.name]:null;
    if(!block?.entities||block.xrefPath){warnings.add('有外部参照或缺失图块，请在 CAD 中绑定外部参照后重试。');continue;}
    const cols=e.columnCount||1,rows=e.rowCount||1;
    if(cols*rows>1000)throw new Error('图块阵列过大，请拆分后导入。');
    const r=(e.rotation||0)*Math.PI/180,c=Math.cos(r),s=Math.sin(r),sx=e.xScale??1,sy=e.yScale??1,p=e.position||{x:0,y:0},base=block.position||{x:0,y:0};
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
     const dx=col*(e.columnSpacing||0),dy=row*(e.rowSpacing||0);
     visit(block.entities,multiply(m,[c*sx,s*sx,-s*sy,c*sy,p.x+c*dx-s*dy-c*sx*base.x+s*sy*base.y,p.y+s*dx+c*dy-s*sx*base.x-c*sy*base.y]),layer,[...chain,e.name]);
    }
   }else if(e.type==='LINE')emit(e.vertices?.[0],e.vertices?.[1],e,m,layer);
   else if(['LWPOLYLINE','POLYLINE'].includes(e.type)){
    if(e.is3dPolygonMesh||e.isPolyfaceMesh||e.is3dPolyline){warnings.add('三维多段线和网格未作为平面墙线导入。');continue;}
    const v=e.vertices||[];for(let i=0;i<v.length-(e.shape?0:1);i++){
     const a=v[i],b=v[(i+1)%v.length],bulge=a.bulge||0;
     if(Math.abs(bulge)<EPS)emit(a,b,e,m,layer,false,e.width||a.startWidth||0);
     else{const chord=distance(a,b),sweep=4*Math.atan(bulge),h=chord*(1-bulge*bulge)/(4*bulge),center={x:(a.x+b.x)/2-(b.y-a.y)/chord*h,y:(a.y+b.y)/2+(b.x-a.x)/chord*h};arc(center,Math.hypot(chord/2,h),Math.atan2(a.y-center.y,a.x-center.x),sweep,e,m,layer);}
    }
   }else if(e.type==='ARC'||e.type==='CIRCLE'){
    const start=e.type==='CIRCLE'?0:e.startAngle;let sweep=e.type==='CIRCLE'?Math.PI*2:e.endAngle-start;if(sweep<=0)sweep+=Math.PI*2;arc(e.center,e.radius,start,sweep,e,m,layer);
   }else ignored++;
  }
 };
 visit(doc.entities);
 if(!segments.length)throw new Error('未找到可用的模型空间线条。请将墙体转成直线或多段线，绑定外部参照后再导出 DXF。');
 const unitCode=doc.header?.$INSUNITS,unit=Object.keys(CAD_UNITS).find(k=>CAD_UNITS[k].code===unitCode)||'';
 return {segments,layers:[...layers.values()],bounds:cadBounds(segments),unit,warnings:[...warnings],ignored};
}

// Clip in drawing coordinates before shifting large survey coordinates to the local origin.
export function clipCADSegment(s,crop){
 if(!crop)return s;
 let lo=0,hi=1;const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y;
 for(const [p,q] of [[-dx,s.a.x-crop.x],[dx,crop.x+crop.w-s.a.x],[-dy,s.a.y-crop.y],[dy,crop.y+crop.h-s.a.y]]){
  if(Math.abs(p)<EPS){if(q<0)return null;continue;}
  const r=q/p;if(p<0)lo=Math.max(lo,r);else hi=Math.min(hi,r);if(lo>=hi)return null;
 }
 return {...s,a:{x:s.a.x+lo*dx,y:s.a.y+lo*dy},b:{x:s.a.x+hi*dx,y:s.a.y+hi*dy}};
}
function frame(s){
 let a=s.a,b=s.b;if(b.x<a.x-EPS||Math.abs(b.x-a.x)<EPS&&b.y<a.y)[a,b]=[b,a];
 const len=distance(a,b),u={x:(b.x-a.x)/len,y:(b.y-a.y)/len},n={x:-u.y,y:u.x};
 return {s,u,n,c:dot(a,n),a:dot(a,u),b:dot(b,u)};
}
const at=(q,t,c=q.c)=>({x:q.u.x*t+q.n.x*c,y:q.u.y*t+q.n.y*c});
const subtract=(range,cuts)=>cuts.reduce((out,[a,b])=>out.flatMap(([x,y])=>b<=x||a>=y?[[x,y]]:[[x,Math.min(y,a)],[Math.max(x,b),y]].filter(([l,r])=>r-l>.025)),[range]);
function stitchWalls(walls){
 for(let i=0;i<walls.length;i++)for(let j=i+1;j<walls.length;j++){
  const a=walls[i],b=walls[j],u={x:a.b.x-a.a.x,y:a.b.y-a.a.y},v={x:b.b.x-b.a.x,y:b.b.y-b.a.y},den=cross(u,v);
  if(Math.abs(den)<length(a)*length(b)*.15)continue;
  const d={x:b.a.x-a.a.x,y:b.a.y-a.a.y},t=cross(d,v)/den,k=cross(d,u)/den,p={x:a.a.x+t*u.x,y:a.a.y+t*u.y},tol=Math.min(.45,(a.thickness+b.thickness)/2+.025);
  if(t< -tol/length(a)||t>1+tol/length(a)||k< -tol/length(b)||k>1+tol/length(b))continue;
  for(const w of [a,b]){const side=distance(w.a,p)<distance(w.b,p)?'a':'b';if(distance(w[side],p)<=tol)w[side]={...p};}
 }
}
function mergeWalls(input,inferDoors){
 const walls=[],gaps=[];
 for(const w of input){let q=frame(w),found=null;
  for(const old of walls){const r=frame(old),a=dot(w.a,r.u),b=dot(w.b,r.u),lo=Math.min(a,b),hi=Math.max(a,b),gap=Math.max(r.a,lo)-Math.min(r.b,hi);
   if(Math.abs(cross(q.u,r.u))>.002||Math.abs(dot(w.a,r.n)-r.c)>.025||Math.abs(w.thickness-old.thickness)>.045||gap>(inferDoors?2.4:.025)||gap>.025&&gap<.55)continue;
   if(gap>.025)gaps.push({a:at(r,Math.min(r.b,hi)),b:at(r,Math.max(r.a,lo))});
   old.a=at(r,Math.min(r.a,lo));old.b=at(r,Math.max(r.b,hi));found=old;break;
  }
  if(!found)walls.push(w);
 }
 // A second pass coalesces segments joined by an intervening fragment.
 if(walls.length<input.length){const next=mergeWalls(walls,false);return {walls:next.walls,gaps:[...gaps,...next.gaps]};}
 return {walls,gaps};
}
export function prepareCAD(raw,{layers,unit,mode='double',thickness=.2,crop=null,inferDoors=true,x=0,y=0}={}){
 const scale=CAD_UNITS[unit]?.scale;if(!scale)throw new Error('请选择 CAD 图纸的单位。');
 if(!Number.isFinite(thickness)||thickness<.03||thickness>1.2)throw new Error('墙厚应为 0.03–1.2 米。');
 if(!Number.isFinite(x)||!Number.isFinite(y))throw new Error('放置位置无效。');
 const chosen=new Set(layers),source=raw.segments.filter(s=>chosen.has(s.layer)).map(s=>clipCADSegment(s,crop)).filter(Boolean),b=cadBounds(source);
 if(!b)throw new Error('所选图层和范围内没有线条。');
 if(b.w*scale>450||b.h*scale>450)throw new Error('范围超过 450 米，请检查单位或框选单层户型。');
 const shift=p=>({x:x+(p.x-b.x)*scale,y:y+(p.y-b.y)*scale});
 const reference=source.map(s=>({...s,a:shift(s.a),b:shift(s.b),width:s.width*scale}));
 if(reference.length>12000)throw new Error('当前范围线条过多，请缩小导入范围或减少图层。');
 const unique=new Map();for(const s of reference.filter(s=>!s.curve&&distance(s.a,s.b)>.03)){const a=[s.a.x,s.a.y].map(v=>v.toFixed(4)).join(','),b=[s.b.x,s.b.y].map(v=>v.toFixed(4)).join(',');unique.set([a,b].sort().join('|'),s);}
 const lines=[...unique.values()];if(lines.length>2500)throw new Error('墙线过多，请只选择墙体图层或缩小范围。');
 let walls=[],review=[];
 const make=(a,b,t)=>({...wall(a,b,Math.max(.03,Math.min(1.2,t))),cad:true});
 if(mode==='center')walls=lines.map(s=>make(s.a,s.b,s.width||thickness));
 else{
  const thin=lines.filter(s=>!s.width),frames=thin.map(frame),cuts=thin.map(()=>[]),pairs=[];
  walls=lines.filter(s=>s.width).map(s=>make(s.a,s.b,s.width));
  for(let i=0;i<frames.length;i++)for(let j=i+1;j<frames.length;j++){
   const a=frames[i],b=frames[j];if(a.s.layer!==b.s.layer||Math.abs(cross(a.u,b.u))>.001)continue;
   const sep=Math.abs(dot(b.s.a,a.n)-a.c),lo=Math.max(a.a,Math.min(dot(b.s.a,a.u),dot(b.s.b,a.u))),hi=Math.min(a.b,Math.max(dot(b.s.a,a.u),dot(b.s.b,a.u)));
   if(sep<.05||sep>.8||hi-lo<.2)continue;
   pairs.push({i,j,sep,lo,hi,score:Math.abs(Math.log(sep/thickness))});
  }
  pairs.sort((a,b)=>a.score-b.score||b.hi-b.lo-(a.hi-a.lo));
  for(const p of pairs){const a=frames[p.i],b=frames[p.j],bc=dot(b.s.a,a.n),bcuts=cuts[p.j].map(([l,r])=>[dot(at(b,l),a.u),dot(at(b,r),a.u)].sort((x,y)=>x-y));
   for(const [lo,hi] of subtract([p.lo,p.hi],[...cuts[p.i],...bcuts])){
    if(hi-lo<.15)continue;walls.push(make(at(a,lo,(a.c+bc)/2),at(a,hi,(a.c+bc)/2),p.sep));cuts[p.i].push([lo,hi]);cuts[p.j].push([dot(at(a,lo),b.u),dot(at(a,hi),b.u)].sort((x,y)=>x-y));
   }
  }
  frames.forEach((q,i)=>{for(const [a,b] of subtract([q.a,q.b],cuts[i]))if(b-a>=.25)review.push(make(at(q,a),at(q,b),thickness));});
 }
 if(walls.length>1000||review.length>1000)throw new Error('候选墙体过多，请缩小范围或减少图层。');
 stitchWalls(walls);const merged=mergeWalls(walls,inferDoors);walls=merged.walls.filter(w=>length(w)>.03);
 const openings=[];
 for(const gap of merged.gaps){const g=frame(gap),mid=at(g,(g.a+g.b)/2);for(const w of walls){const q=frame(w),offset=dot(mid,q.u)-q.a,width=distance(gap.a,gap.b);if(Math.abs(cross(q.u,g.u))>.002||Math.abs(dot(mid,q.n)-q.c)>.03||offset-width/2<.01||offset+width/2>length(w)-.01)continue;if(openings.some(o=>o.wallId===w.id&&Math.abs(o.offset-offset)<(o.width+width)/2))continue;openings.push({id:uid(),wallId:w.id,type:'door',offset,width,height:2.1,sill:0,hinge:1,inferred:true});break;}}
 return {walls,review,openings,reference,bounds:{x,y,w:Math.max(.1,b.w*scale),h:Math.max(.1,b.h*scale)},unit,origin:{x:b.x,y:b.y},warnings:raw.warnings,curves:reference.filter(s=>s.curve).length};
}
export function applyCAD(floor,result,{selectedIds,name='CAD 图纸',replace=false}={}){
 const f=clone(floor),chosen=new Set(selectedIds??result.walls.map(w=>w.id)),walls=[...result.walls,...result.review].filter(w=>chosen.has(w.id));
 if(!walls.length)throw new Error('请至少选择一段要生成的墙体。');
 const importId=uid(),removed=new Set(replace&&f.cad?.importId?f.walls.filter(w=>w.cadImportId===f.cad.importId).map(w=>w.id):[]);
 if(f.walls.some(w=>removed.has(w.id)&&w.locked)||f.openings.some(o=>removed.has(o.wallId)&&o.locked))throw new Error('上次 CAD 导入的墙或门窗已锁定，请先解锁再替换。');
 f.walls=f.walls.filter(w=>!removed.has(w.id));f.openings=f.openings.filter(o=>!removed.has(o.wallId));
 f.walls.push(...walls.map(w=>({...clone(w),cadImportId:importId})));f.openings.push(...result.openings.filter(o=>chosen.has(o.wallId)).map(clone));
 f.cad={name:String(name).slice(0,120),unit:result.unit,importId,segments:result.reference.map(({a,b,curve})=>({a,b,curve})),hidden:false};
 if(f.walls.length>1500)throw new Error('当前楼层墙体过多，请拆分楼层后导入。');
 f.rooms=refreshRooms(f);validateProject({version:2,units:'m',floors:[f]});Object.assign(floor,f);
 return walls.length;
}
