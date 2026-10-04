import {CAD_UNITS,cadBounds,prepareCAD,applyCAD} from './cad.js';

async function readCAD(file,dialog){
 if(file.size>30*1024*1024)throw new Error('DXF 请控制在 30 MB 以内。');
 const bytes=await file.arrayBuffer();if(!dialog.open)return null;
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./cad-worker.js',import.meta.url),{type:'module'});
  const finish=(value,error)=>{clearTimeout(timer);dialog.removeEventListener('close',cancel);worker.terminate();error?reject(new Error(error)):resolve(value);};
  const cancel=()=>finish(null),timer=setTimeout(()=>finish(null,'读取超时，请在 CAD 中只保留所需楼层再导出。'),20000);
  dialog.addEventListener('close',cancel,{once:true});worker.onmessage=e=>finish(e.data.result,e.data.error);worker.onerror=()=>finish(null,'DXF 读取失败，请重新导出 ASCII DXF。');worker.postMessage(bytes,[bytes]);
 });
}
export async function openCADImport({file,$,floor,modal,esc,mutate,setMode,setTool,fitPlan,viewer,toast,ui}){
 const target=floor().id,before=JSON.stringify(floor());
 const d=modal('导入 CAD · DXF',`<p class="muted">${esc(file.name)}</p><p role="status">正在读取图层和线条…</p>`,'<button class="btn" id="cancelCAD">取消</button>');
 $('#cancelCAD').onclick=()=>d.close();
 let raw;try{raw=await readCAD(file,d);}catch(e){if(d.open){d.querySelector('[role="status"]').textContent=e.message;}return;}
 if(!raw||!d.open)return;
 const recommended=raw.layers.filter(l=>l.visible&&l.recommended),fallback=raw.layers.filter(l=>l.visible).sort((a,b)=>b.count-a.count)[0];
 const layers=new Set(recommended.length?recommended.map(l=>l.name):fallback?[fallback.name]:[]);
 let crop=null,result=null,selection=new Set(),cropping=false,drag=null;
 modal('导入 CAD · DXF',`<p class="muted cad-file">${esc(file.name)} · 导入到 ${esc(floor().name)}</p><div class="cad-import-layout"><div class="cad-preview-column"><div class="cad-preview-actions"><button class="btn small" id="cropCAD" aria-pressed="false" title="同一张 CAD 有多个楼层时，拖出矩形，只导入其中一个范围。">框选当前楼层</button><button class="btn small" id="resetCADRange" disabled>清除范围</button><span id="cadSize"></span></div><svg id="cadPreview" class="cad-preview" aria-label="CAD 图纸与候选墙体预览"></svg><div class="recognition-legend"><span class="accepted">绿色：将生成墙体</span><span class="review">黄色：待确认，点击加入</span></div><div class="cad-status" id="cadStatus" role="status" aria-live="polite">确认单位和墙体图层，然后点击“分析墙线”。</div>${raw.warnings.length?`<p class="muted">${raw.warnings.map(esc).join('<br>')}</p>`:''}<p class="muted" title="文字、标注和填充不会转换为墙。圆弧保留为 CAD 参考线；需要的门窗可在生成模型后补充。">${raw.ignored?'文字、标注等 '+raw.ignored+' 个构件未作为墙线读取。':'图纸在本机处理，线条按 CAD 坐标读取。'}</p></div><div class="cad-settings"><label class="field"><span>图纸单位</span><select id="cadUnit" aria-label="CAD 图纸单位"><option value="">请选择单位</option>${Object.entries(CAD_UNITS).map(([k,v])=>`<option value="${k}" ${raw.unit===k?'selected':''}>${v.name}（${k}）</option>`).join('')}</select></label><p class="muted cad-unit-note">${raw.unit?'已读取文件单位，可对照预览尺寸核对。':'文件未标明可用单位，请选择后再分析。'}</p><h3>墙体图层</h3><div class="cad-layer-list">${raw.layers.map((l,i)=>`<label title="${esc(l.name)}${l.visible?'':' · 原图层已关闭'}"><input type="checkbox" data-cad-layer="${i}" ${layers.has(l.name)?'checked':''}><span>${esc(l.name)}</span><small>${l.count}</small></label>`).join('')}</div><label class="field"><span>墙线画法</span><select id="cadMode" aria-label="墙线画法"><option value="double">双线墙 · 提取中线</option><option value="center">单线墙 · 按线生成</option></select></label><label class="field" title="单线墙的墙厚；双线墙优先匹配此厚度附近的线对，并使用实际间距。"><span>参考墙厚 / m</span><input id="cadThickness" aria-label="参考墙厚 / m" type="number" value="0.2" min="0.03" max="1.2" step="0.01"></label><label class="toggle-row" title="按共线墙段之间的间隙推测门洞；蓝色虚线为候选门洞，生成后可改成窗或删除。">推测门洞<input type="checkbox" id="cadDoors" checked></label><details class="cad-placement"><summary>放置位置与重复导入</summary><div class="field-row"><label class="field"><span>放置 X / m</span><input id="cadX" type="number" value="0" step=".1" aria-label="CAD 放置 X / m"></label><label class="field"><span>放置 Y / m</span><input id="cadY" type="number" value="0" step=".1" aria-label="CAD 放置 Y / m"></label></div><label class="field"><span>导入方式</span><select id="cadApplyMode" aria-label="CAD 导入方式"><option value="append">追加到当前楼层</option>${floor().cad?`<option value="replace" ${floor().cad.name===file.name?'selected':''}>替换上次 CAD 导入的墙</option>`:''}</select></label></details></div></div>`,'<button class="btn" id="cancelCAD">取消</button><button class="btn" id="analyzeCAD">分析墙线</button><button class="btn primary" id="applyCAD" disabled>生成可编辑模型</button>');
 d.classList.add('cad-dialog');const svg=$('#cadPreview'),status=$('#cadStatus'),apply=$('#applyCAD');
 const bounds=raw.bounds,pad=Math.max(bounds.w,bounds.h)*.025||1;
 svg.setAttribute('viewBox',`${bounds.x-pad} ${bounds.y-pad} ${Math.max(bounds.w,.1)+pad*2} ${Math.max(bounds.h,.1)+pad*2}`);
 const options=()=>({unit:$('#cadUnit').value,layers:[...layers],mode:$('#cadMode').value,thickness:Number($('#cadThickness').value),inferDoors:$('#cadDoors').checked,crop,x:Number($('#cadX').value),y:Number($('#cadY').value)});
 const updateStatus=()=>{apply.disabled=!result||!selection.size;if(result)status.textContent=`已选 ${selection.size} 段墙 · ${result.openings.filter(o=>selection.has(o.wallId)).length} 个候选门洞${result.curves?' · 圆弧仅保留参考线':''}。${selection.size?'确认后生成模型，可撤销。':'可点击黄色线加入，或切换为单线墙重新分析。'}`;};
 const draw=()=>{
  const filtered=raw.segments.filter(s=>layers.has(s.layer)),b=crop||cadBounds(filtered),scale=CAD_UNITS[$('#cadUnit').value]?.scale;
  $('#cadSize').textContent=b&&scale?`${(b.w*scale).toFixed(2)} × ${(b.h*scale).toFixed(2)} m`:'请选择图纸单位';
  svg.innerHTML=`<path d="${filtered.map(s=>`M${s.a.x},${s.a.y}L${s.b.x},${s.b.y}`).join('')}" class="cad-source"/>`;
  if(crop)svg.innerHTML+=`<rect class="cad-range" x="${crop.x}" y="${crop.y}" width="${crop.w}" height="${crop.h}"/>`;
  if(result){const o=options(),back=p=>({x:(p.x-o.x)/scale+result.origin.x,y:(p.y-o.y)/scale+result.origin.y});
   svg.innerHTML+=[...result.walls,...result.review].map((w,i)=>{const a=back(w.a),b=back(w.b),chosen=selection.has(w.id);return `<g class="cad-candidate ${chosen?'accepted':'review'}" data-cad-wall="${w.id}" role="button" tabindex="0" aria-label="墙线 ${i+1} ${chosen?'已选':'待确认'}" aria-pressed="${chosen}"><title>${lengthText(w)} · ${chosen?'点击排除':'点击加入'}</title><path d="M${a.x},${a.y}L${b.x},${b.y}" class="cad-wall" stroke-width="${w.thickness/scale}"/><path d="M${a.x},${a.y}L${b.x},${b.y}" class="cad-hit"/></g>`;}).join('');
   for(const door of result.openings){if(!selection.has(door.wallId))continue;const w=result.walls.find(w=>w.id===door.wallId),len=Math.hypot(w.b.x-w.a.x,w.b.y-w.a.y),p=t=>back({x:w.a.x+(w.b.x-w.a.x)*t/len,y:w.a.y+(w.b.y-w.a.y)*t/len}),a=p(door.offset-door.width/2),b=p(door.offset+door.width/2);svg.innerHTML+=`<path d="M${a.x},${a.y}L${b.x},${b.y}" class="cad-door"/>`;}
  }
  $('#resetCADRange').disabled=!crop;svg.classList.toggle('cropping',cropping);$('#cropCAD').setAttribute('aria-pressed',String(cropping));updateStatus();
 };
 const invalidate=()=>{result=null;selection.clear();status.textContent='选项已修改，请点击“分析墙线”更新预览。';draw();};
 d.querySelectorAll('[data-cad-layer]').forEach(input=>input.onchange=()=>{const name=raw.layers[Number(input.dataset.cadLayer)].name;input.checked?layers.add(name):layers.delete(name);invalidate();});
 for(const id of ['cadUnit','cadMode','cadThickness','cadDoors','cadX','cadY'])$('#'+id).oninput=invalidate;
 $('#cancelCAD').onclick=()=>d.close();$('#cropCAD').onclick=()=>{cropping=!cropping;draw();};$('#resetCADRange').onclick=()=>{crop=null;invalidate();};
 const svgPoint=e=>{const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(svg.getScreenCTM().inverse());};
 svg.onpointerdown=e=>{if(!cropping)return;e.preventDefault();drag=svgPoint(e);svg.setPointerCapture(e.pointerId);};
 svg.onpointermove=e=>{if(!drag)return;const p=svgPoint(e);crop={x:Math.min(p.x,drag.x),y:Math.min(p.y,drag.y),w:Math.abs(p.x-drag.x),h:Math.abs(p.y-drag.y)};result=null;selection.clear();draw();};
 svg.onpointerup=()=>{if(!drag)return;drag=null;if(crop&&Math.min(crop.w,crop.h)<=pad*.01)crop=null;cropping=false;invalidate();};svg.onpointercancel=()=>{drag=null;};
 const toggle=e=>{if(cropping||!result)return;const el=e.target.closest('[data-cad-wall]');if(!el)return;const id=el.dataset.cadWall;selection.has(id)?selection.delete(id):selection.add(id);draw();};svg.onclick=toggle;svg.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle(e);}};
 $('#analyzeCAD').onclick=()=>{try{result=prepareCAD(raw,options());selection=new Set(result.walls.map(w=>w.id));cropping=false;draw();}catch(e){result=null;selection.clear();draw();status.textContent=e.message;}};
 apply.onclick=()=>{
  if(!result||!selection.size)return;
  if(floor().id!==target||JSON.stringify(floor())!==before){status.textContent='当前楼层已发生变化，请关闭后重新导入。';return;}
  let count=0;const ok=mutate(()=>{count=applyCAD(floor(),result,{selectedIds:[...selection],name:file.name,replace:$('#cadApplyMode').value==='replace'});ui.sel=null;ui.multi=[];});
  if(!ok)return;d.close();setTool('select');setMode(innerWidth<700?'3d':'split');fitPlan();viewer?.fit();toast(`已按 CAD 尺寸生成 ${count} 段墙，可用手动修复调整；Ctrl+Z 撤销`);
 };
 draw();
}
function lengthText(w){return `墙长 ${Math.hypot(w.b.x-w.a.x,w.b.y-w.a.y).toFixed(2)} m · 墙厚 ${w.thickness.toFixed(2)} m`;}
