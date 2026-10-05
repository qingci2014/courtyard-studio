import {phaseFloor,PHASES,PHASE_COLORS,constructionStatus,revisionLabel,constructionWarnings} from './renovation.js';
import {dimensionValue,resolveAnchor,resolvePoint,wallPoint,wallBasis,furnitureCorners,elevationGeometry,POINT_TYPES,drawingIssues} from './delivery-model.js';
import {wallFootprint,wallFinishGeometry} from './quantities.js';
import {roomLabelPoint,polygonContains} from './room-geometry.js';

export const escapeXML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const line=(a,b,color='#65727c',width=.015,dash=false)=>({type:'line',a,b,color,width,dash});
const text=(x,y,value,size=.13,color='#354550')=>({type:'text',x,y,text:String(value),size,color});
const poly=(points,fill='#ece9e3',color='#65727c',width=.015)=>({type:'poly',points,fill,color,width});
const rect=(x,y,w,h,fill='none',color='#65727c',width=.015)=>poly([[x,y],[x+w,y],[x+w,y+h],[x,y+h]],fill,color,width);
const circle=(x,y,r,color='#4f6d86',fill='#fff')=>({type:'circle',x,y,r,color,fill,width:.015});
const point=q=>[q.x,q.y];
const length=w=>wallBasis(w).length;
function addDimension(items,a,b,label,axis='aligned',offset=.45,color='#4f6d86'){
 let p,q;
 if(axis==='horizontal'){const y=Math.min(a.y,b.y)-offset;p={x:a.x,y};q={x:b.x,y};}
 else if(axis==='vertical'){const x=Math.max(a.x,b.x)+offset;p={x,y:a.y};q={x,y:b.y};}
 else{const d=Math.hypot(b.x-a.x,b.y-a.y);if(d<.001)return;const nx=-(b.y-a.y)/d,ny=(b.x-a.x)/d;p={x:a.x+nx*offset,y:a.y+ny*offset};q={x:b.x+nx*offset,y:b.y+ny*offset};}
 items.push(line(point(a),point(p),color,.008),line(point(b),point(q),color,.008),line(point(p),point(q),color,.01));
 for(const v of [p,q])items.push(line([v.x-.05,v.y+.05],[v.x+.05,v.y-.05],color,.014));
 let rotation=Math.atan2(q.y-p.y,q.x-p.x)*180/Math.PI;if(rotation>90||rotation< -90)rotation+=180;
 const t=text((p.x+q.x)/2,(p.y+q.y)/2-.08,label,.12,color);t.rotation=rotation;items.push(t);
}
export function annotationItems(f,phase='proposed'){
 const items=[];
 for(const d of f.delivery?.dimensions||[]){if(d.phase&&d.phase!==phase)continue;const r=dimensionValue(f,d);if(r.error){if(r.a&&r.b)items.push(text((r.a.x+r.b.x)/2,(r.a.y+r.b.y)/2,'参照变化 · 待复核',.14,'#c65345'));continue;}
  addDimension(items,r.a,r.b,`${d.label?d.label+' ':''}${Math.round(r.value*1000)}${r.manual?' *':''}`,d.axis,d.offset);
 }
 for(const n of f.delivery?.notes||[]){if(n.phase&&n.phase!==phase)continue;const p=resolveAnchor(f,n.anchor);if(p.error)continue;items.push(line([p.x,p.y],[p.x+n.dx,p.y+n.dy],'#6b7178',.01),circle(p.x,p.y,.025,'#6b7178','#6b7178'));wrapText(n.text,20).forEach((value,i)=>items.push({...text(p.x+n.dx,p.y+n.dy-.04+i*.2,value,.14),align:'left'}));}
 for(const p of f.delivery?.points||[]){const q=resolvePoint(f,p);if(q.error)continue;
  items.push(circle(q.x,q.y,.10,'#3877aa'),text(q.x,q.y+.045,({socket:'S',switch:'K',light:'L',water:'W',drain:'D',floorDrain:'D',ac:'A',heater:'H',data:'N'})[p.type]||'P',.12),text(q.x+.22,q.y-.14,p.code,.12));
  for(const id of p.controls||[]){const target=f.delivery.points.find(q=>q.id===id),v=target&&resolvePoint(f,target);if(v&&!v.error)items.push(line([q.x,q.y],[v.x,v.y],'#9d7b36',.012,true));}
 }
 return items;
}
export function planScene(project,floorId,phase='proposed',{pointsOnly=false}={}){
 const f=phaseFloor(project,floorId,phase),items=[];
 for(const r of f.rooms)items.push(poly(r.poly,'#f4f2ee','#dfdcd5',.006));
 for(const w of f.walls){const status=constructionStatus(w),color=phase==='original'?'#65727c':PHASE_COLORS[status],demolish=phase!=='original'&&status==='demolish';items.push({...poly(wallFootprint(w),demolish?'#f8e9e5':color,color),dash:demolish});const p=wallPoint(w,length(w)/2);let rotation=Math.atan2(w.b.y-w.a.y,w.b.x-w.a.x)*180/Math.PI;if(rotation>90||rotation< -90)rotation+=180;items.push({...text(p.x,p.y+.035,w.code||'',.10,demolish?color:'#fff'),rotation});}
 for(const o of f.openings){const w=f.walls.find(w=>w.id===o.wallId);if(!w)continue;const ends=[wallPoint(w,o.offset-o.width/2,1),wallPoint(w,o.offset+o.width/2,1),wallPoint(w,o.offset+o.width/2,-1),wallPoint(w,o.offset-o.width/2,-1)];items.push(poly(ends.map(point),'#fff',o.type==='door'?'#ab8752':'#628ba6',.015));}
 for(const o of f.furniture){items.push(poly(furnitureCorners(o).map(point),'#f0ece4','#a59986'));items.push(text(o.x,o.y,o.code||o.name||'',.12));}
 for(const o of f.solids||[]){items.push(poly(o.poly,'#e5ddd0','#9b8a75'));for(const hole of o.holes||[])items.push(poly(hole,'#fff','#9b8a75'));}
 for(const o of f.stairs){items.push(poly(furnitureCorners(o).map(point),'#eee8dc','#a59986'));items.push(text(o.x,o.y,'楼梯',.15));}
 const obstacles=[...f.furniture,...f.stairs].map(o=>furnitureCorners(o).map(point)).concat((f.solids||[]).map(o=>o.poly),f.walls.map(wallFootprint));
 for(const r of f.rooms){const center=roomLabelPoint(r.poly),xs=r.poly.map(p=>p[0]),ys=r.poly.map(p=>p[1]),x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y,candidates=[center];for(let i=1;i<8;i++)for(let j=1;j<8;j++)candidates.push({x:x+w*i/8,y:y+h*j/8});const free=candidates.filter(p=>[-.25,0,.25].every(dx=>polygonContains([p.x+dx,p.y],r.poly,true)&&!obstacles.some(poly=>polygonContains([p.x+dx,p.y],poly)))).sort((a,b)=>Math.hypot(a.x-center.x,a.y-center.y)-Math.hypot(b.x-center.x,b.y-center.y));const p=free[0]||center;items.push(rect(p.x-r.name.length*.09-.05,p.y-.17,r.name.length*.18+.1,.23,'#f4f2ee','#f4f2ee',.001),text(p.x,p.y,r.name,.18));}
 items.push(...annotationItems(pointsOnly?{...f,delivery:{...f.delivery,dimensions:[],notes:[]}}:f,phase));
 return {title:`${f.name} · ${pointsOnly?'水电点位图':PHASES[phase]}`,items,issues:drawingIssues(project,floorId,phase).map(x=>x.message)};
}
export function elevationScene(project,floorId,elevation){
 const f=phaseFloor(project,floorId),g=elevationGeometry(f,elevation);if(g.error)throw new Error(`${elevation.name}：${g.error}`);
 const items=[rect(0,0,g.width,g.height,'#f7f5f0')];
 for(const finish of f.delivery?.finishes||[]){if(finish.surface!=='wall'||finish.targetId!==g.wall.id||finish.side!==elevation.side)continue;const z=wallFinishGeometry(f,finish);if(z.error)continue;const x=elevation.side===1?z.x:g.width-z.X;items.push(rect(x,g.height-z.Y,z.X-z.x,z.Y-z.y,finish.color||'#dfdad2','#c7bba7'));items.push(text(x+(z.X-z.x)/2,g.height-z.Y+.22,finish.name,.12));}
 const schedule=g.items.map(o=>`${o.name} · 宽 ${Math.round(o.w*1000)} · 高 ${Math.round(o.h*1000)} · 距本立面左端 ${Math.round(o.x*1000)} · 底高 ${Math.round(o.y*1000)} mm`);
 for(const o of g.items){items.push(rect(o.x,g.height-o.y-o.h,o.w,o.h,o.kind==='door'||o.kind==='window'?'#fff':'#e6dfd3'));items.push({...text(o.x+.08,g.height-o.y-o.h+.20,o.name,.13),align:'left'});}
 for(const p of g.points){items.push(circle(p.x,g.height-p.y,.08),text(p.x+.24,g.height-p.y-.12,p.code,.11));schedule.push(`${p.code} ${POINT_TYPES[p.type]} · H ${Math.round(p.height*1000)} · 距墙起点 A ${Math.round(p.offset*1000)} mm`);}
 schedule.forEach((value,i)=>items.push({...text(0,g.height+1.15+i*.25,value,.13),align:'left'}));
 addDimension(items,{x:0,y:g.height},{x:g.width,y:g.height},String(Math.round(g.width*1000)),'horizontal',-.45);
 addDimension(items,{x:g.width,y:g.height},{x:g.width,y:0},String(Math.round(g.height*1000)),'vertical',.45);
 items.push(text(g.width/2,g.height+.82,`完成地面 ±0.000 · 投影深度 ${elevation.depth} m · ${elevation.side===1?'A':'B'} 面`,.13));
 return {title:`${f.name} · ${elevation.name}`,items,issues:[]};
}
export function itemsBounds(items){
 const pts=items.flatMap(i=>{if(i.type==='poly')return i.points;if(i.type==='line')return [i.a,i.b];if(i.type==='circle')return [[i.x-i.r,i.y-i.r],[i.x+i.r,i.y+i.r]];const w=Array.from(i.text).length*i.size,h=i.size*1.5,vertical=Math.abs(i.rotation||0)%180===90;return vertical?[[i.x-h,i.y-w/2],[i.x+h,i.y+w/2]]:[[i.x-(i.align==='left'?0:w/2),i.y-h],[i.x+(i.align==='left'?w:w/2),i.y+h/2]];});
 if(!pts.length)return {x:0,y:0,w:1,h:1};const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),x=Math.min(...xs),y=Math.min(...ys);return {x,y,w:Math.max(.1,Math.max(...xs)-x),h:Math.max(.1,Math.max(...ys)-y)};
}
function transform(items,scale,dx,dy){return items.map(o=>{const q={...o,width:Math.max(.12,(o.width||.01)*scale),dashArray:o.dash?[.1*scale,.08*scale]:undefined};if(o.type==='poly')q.points=o.points.map(([x,y])=>[x*scale+dx,y*scale+dy]);else if(o.type==='line'){q.a=[o.a[0]*scale+dx,o.a[1]*scale+dy];q.b=[o.b[0]*scale+dx,o.b[1]*scale+dy];}else{q.x=o.x*scale+dx;q.y=o.y*scale+dy;if(o.type==='circle')q.r=o.r*scale;else q.size=Math.max(1.6,Math.min(3.3,o.size*scale));}return q;});}
export function drawingSheets(project,{paper='A3',scale=50,phases=['proposed'],floorIds=[...new Set([...project.floors,...(project.delivery?.baseline?.floors||[])].map(f=>f.id))],elevations=true,points=true}={}){
 if(!['A3','A4'].includes(paper)||![20,25,50,75,100,150,200].includes(Number(scale)))throw new Error('请选择有效图幅与比例');
 const width=paper==='A3'?420:297,height=paper==='A3'?297:210,scenes=[];
 for(const floorId of floorIds){const f=project.floors.find(f=>f.id===floorId);for(const phase of phases){if(!PHASES[phase])throw new Error('图纸状态无效');if(phaseFloor(project,floorId,phase))scenes.push(planScene(project,floorId,phase));}if(!f)continue;
  if(elevations)for(const e of f.delivery?.elevations||[])scenes.push(elevationScene(project,floorId,e));
  if(points&&f.delivery?.points.length)scenes.push(planScene(project,floorId,'proposed',{pointsOnly:true}));
 }
 if(!scenes.length)throw new Error('至少选择一种图纸');
 const source=project.delivery?.source||'estimated',basis=source==='estimated'?'尺寸待校准 · 仅供方案讨论':source==='calibrated'?'按图校准 · 施工前需现场复核':'已记录现场复核依据';
 const timestamp=project.delivery?.issuedAt||new Date().toISOString(),date=new Date(timestamp).toLocaleDateString('zh-CN');
 const sheets=scenes.map(scene=>{
  const b=itemsBounds(scene.items),factor=1000/scale,availableW=width-32,availableH=height-65;
  if(b.w*factor>availableW||b.h*factor>availableH){const suggested=[20,25,50,75,100,150,200].find(s=>b.w*1000/s<=availableW&&b.h*1000/s<=availableH);throw new Error(`${scene.title} 超出 ${paper} 1:${scale} 图框，请选择 ${suggested?'1:'+suggested:'更大图幅或拆分楼层'}；不会自动改变比例`);}
  const items=transform(scene.items,factor,(width-b.w*factor)/2-b.x*factor,18+(availableH-b.h*factor)/2-b.y*factor);
  items.push(rect(8,8,width-16,height-16,'none','#4f6d86',.3),line([8,height-34],[width-8,height-34],'#4f6d86',.3));
  items.push(text(width/2,14,scene.title,3.6),text(width/2,height-27,`${project.name} · ${revisionLabel(project)}`,3),text(width/2,height-21,`${paper} · 1:${scale} · 标注单位 mm · ${date} · 打印选择实际大小 / 100%`,2.4),text(width/2,height-15,basis,2.5,source==='estimated'?'#c65345':'#65727c'),text(width/2,height-10,'灰：保留  红虚线：拆除  蓝：新建 · * 自由参照尺寸 · H 距完成地面高度',2.1));
  return {width,height,title:scene.title,items,scale,issues:scene.issues};
 });
 const issues=[basis,project.delivery?.sourceNote||'未填写尺寸依据',...constructionWarnings(project),...scenes.flatMap(s=>s.issues)];
 const schedule=[];for(const f of project.floors)for(const p of phaseFloor(project,f.id).delivery?.points||[]){const pos=resolvePoint(phaseFloor(project,f.id),p),w=f.walls.find(w=>w.id===p.wallId);schedule.push(`${f.name} / ${p.code} ${POINT_TYPES[p.type]||p.type} / ${p.surface==='wall'?`${w?.code||'墙失效'} ${p.side===1?'A':'B'}面 距A端 ${Math.round(p.offset*1000)} mm`:`X ${p.x.toFixed(3)} Y ${p.y.toFixed(3)} m`} / ${p.surface==='ceiling'?'距顶':'离地'} ${Math.round(p.height*1000)} mm / ${p.device||'未填设备'}${pos.error?' / '+pos.error:''}`);if(p.note)schedule.push(`  ${p.code} 说明：${p.note}`);if(p.controls?.length)schedule.push(`  ${p.code} 控制：${p.controls.map(id=>f.delivery.points.find(q=>q.id===id)?.code||'失效灯具').join('、')}`);}
 const lines=[...new Set(issues),...(points&&schedule.length?['—— 点位定位表 ——',...schedule]:[])].flatMap(s=>wrapText(s,Math.floor((width-30)/2.5)));
 for(let start=0;start<lines.length;start+=Math.floor((height-45)/6)){const subset=lines.slice(start,start+Math.floor((height-45)/6));sheets.push({width,height,title:'图纸说明与点位表',scale:null,issues:[],items:[rect(8,8,width-16,height-16,'none','#4f6d86',.3),text(width/2,17,`${project.name} · ${revisionLabel(project)} · 说明与点位表`,3.4),...subset.map((s,i)=>({...text(15,28+i*6,s,2.5),align:'left'}))]});}
 sheets.forEach((s,i)=>s.items.push(text(s.width-14,s.height-3,`${i+1} / ${sheets.length}`,2)));
 return sheets;
}
function wrapText(value,max){const s=String(value);const result=[];for(const line of s.split('\n')){const chars=Array.from(line);if(!chars.length)result.push('');for(let i=0;i<chars.length;i+=max)result.push(chars.slice(i,i+max).join(''));}return result;}
export function itemsSVG(items){return items.map(o=>{
 const stroke=`stroke="${escapeXML(o.color||'#65727c')}" stroke-width="${o.width||.01}"${o.dash?` stroke-dasharray="${(o.dashArray||[.1,.08]).join(' ')}"`:''}`;
 if(o.type==='line')return `<line x1="${o.a[0]}" y1="${o.a[1]}" x2="${o.b[0]}" y2="${o.b[1]}" ${stroke}/>`;
 if(o.type==='poly')return `<polygon points="${o.points.map(p=>p.join(',')).join(' ')}" fill="${escapeXML(o.fill||'none')}" ${stroke}/>`;
 if(o.type==='circle')return `<circle cx="${o.x}" cy="${o.y}" r="${o.r}" fill="${escapeXML(o.fill||'none')}" ${stroke}/>`;
 return `<text x="${o.x}" y="${o.y}" text-anchor="${o.align==='left'?'start':'middle'}" font-size="${o.size}" fill="${escapeXML(o.color)}" transform="rotate(${o.rotation||0} ${o.x} ${o.y})" font-family="Arial,Microsoft YaHei,sans-serif">${escapeXML(o.text)}</text>`;
 }).join('');}
export function sheetSVG(sheet){return `<svg xmlns="http://www.w3.org/2000/svg" width="${sheet.width}mm" height="${sheet.height}mm" viewBox="0 0 ${sheet.width} ${sheet.height}" role="img" aria-label="${escapeXML(sheet.title)}"><rect width="100%" height="100%" fill="white"/>${itemsSVG(sheet.items)}</svg>`;}
export async function exportDrawingPDF(project,options={},fontBytes){
 const [{PDFDocument,rgb,degrees},fontkit]=await Promise.all([import('pdf-lib'),import('@pdf-lib/fontkit')]);
 const sheets=drawingSheets(project,options),doc=await PDFDocument.create();doc.registerFontkit(fontkit.default);
 if(!fontBytes){const response=await fetch(new URL((import.meta.env.BASE_URL||'./')+'fonts/NotoSansSC-Regular.ttf',document.baseURI));if(!response.ok)throw new Error('中文出图字体加载失败，请检查本地资源');fontBytes=await response.arrayBuffer();}
 const font=await doc.embedFont(fontBytes,{subset:false}),mm=72/25.4;
 const color=hex=>{const value=/^#[\da-f]{3}$/i.test(hex)?'#'+hex.slice(1).split('').map(c=>c+c).join(''):hex;const h=/^#[\da-f]{6}$/i.test(value)?value.slice(1):'65727c';return rgb(parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255);};
 doc.setTitle(`${project.name} · ${revisionLabel(project)}`);doc.setSubject('家装 / 小型工装方案图纸');doc.setCreator('筑间');
 for(const s of sheets){const page=doc.addPage([s.width*mm,s.height*mm]);for(const o of s.items){
  if(o.type==='text'){const size=o.size*mm,txt=o.text.replace(/[\u0000-\u001f]/g,' '),w=font.widthOfTextAtSize(txt,size),rotation=-(o.rotation||0),r=rotation*Math.PI/180,offset=o.align==='left'?0:w/2;page.drawText(txt,{x:o.x*mm-offset*Math.cos(r),y:(s.height-o.y)*mm-offset*Math.sin(r),rotate:degrees(rotation),size,font,color:color(o.color)});}
  else if(o.type==='line')page.drawLine({start:{x:o.a[0]*mm,y:(s.height-o.a[1])*mm},end:{x:o.b[0]*mm,y:(s.height-o.b[1])*mm},thickness:o.width*mm,color:color(o.color),...(o.dash?{dashArray:(o.dashArray||[.1,.08]).map(v=>v*mm)}:{})});
  else if(o.type==='circle')page.drawCircle({x:o.x*mm,y:(s.height-o.y)*mm,size:o.r*mm,borderWidth:o.width*mm,borderColor:color(o.color),...(o.fill&&o.fill!=='none'?{color:color(o.fill)}:{})});
  else{const path=o.points.map(([x,y],i)=>(i?'L':'M')+`${x*mm} ${y*mm}`).join(' ')+' Z';page.drawSvgPath(path,{x:0,y:s.height*mm,borderColor:color(o.color),borderWidth:o.width*mm,...(o.dash?{borderDashArray:(o.dashArray||[.1,.08]).map(v=>v*mm)}:{}),...(o.fill&&o.fill!=='none'?{color:color(o.fill)}:{})});}
 }}return {bytes:await doc.save(),sheets};
}
