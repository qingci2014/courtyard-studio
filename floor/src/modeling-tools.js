import * as M from './model.js';
import * as E from './editing.js';
import {makeSolid,rectangleContour,offsetSolid,normalizeSection,sceneBounds,validateScene} from './modeling.js';
import {applyPushPull} from './push-pull.js';

export function installModelingTools(app){
 const {$,ui,view,viewer,getProject,setProject,floor,selected,selectionRefs,setSelection,setTool,setMode,render,renderPlan,mutate,history,changed,toast,esc}=app;
 const state={tab:'push',shape:'rect',points:[],preset:'column',height:floor().height,base:0,color:'#d4cabb',offsetKind:'ceiling',offsetWidth:.3,offsetHeight:.15,offsetBase:floor().height-.15,preview:true,sceneName:'场景 1',sceneId:''};
 ui.modelingOpen=false;ui.roofVisible=true;ui.section=normalizeSection();
 $('#guideTool').insertAdjacentHTML('afterend','<button class="btn small plan-repair" id="modelingButton" aria-expanded="false" aria-controls="modelingToolbar">建模工具</button>');
 $('#repairToolbar').insertAdjacentHTML('afterend','<section class="modeling-toolbar" id="modelingToolbar" aria-label="建模工具栏" hidden></section>');
 const bar=$('#modelingToolbar'),project=()=>getProject();let cachedMarkup='',offsetCache=null,pullBefore=null;
 const n=(label,id,value,min,max,step=.05)=>`<label class="toolbar-field"><span>${label}</span><input id="${id}" aria-label="${label}" type="number" value="${Math.round(value*1000)/1000}" min="${min}" max="${max}" step="${step}"></label>`;
 const btn=(id,label,tip,extra='')=>`<button class="btn small" id="${id}" title="${esc(tip)}" ${extra}>${label}</button>`;
 const path=o=>[o.poly,...(o.holes||[])].map(p=>'M'+p.map(q=>q.join(',')).join('L')+'Z').join(' ');
 function activeHeight(){const refs=selectionRefs();return ui.tool==='select'&&refs.length===1&&['wall','solid'].includes(refs[0].kind)?{ref:refs[0],o:E.entity(floor(),refs[0])}:null;}
 function offsetPreview(){
  if(ui.sel?.kind!=='room'||!selected())return {error:'先点击一个房间地面'};
  const source=selected(),key=JSON.stringify([source.poly,state.offsetWidth,state.offsetHeight,state.offsetBase,state.offsetKind]);
  if(offsetCache?.key===key)return offsetCache;
  try{const name={ceiling:'吊顶边',skirting:'踢脚线',platform:'平台边框'}[state.offsetKind],solid=offsetSolid(source.poly,{distance:state.offsetWidth,height:state.offsetHeight,base:state.offsetBase,name:source.name+' · '+name,color:state.offsetKind==='platform'?'#c9b797':'#dedbd2'});offsetCache={key,solid};}catch(e){offsetCache={key,error:e.message};}return offsetCache;
 }
 function pushMarkup(){
  const active=activeHeight(),height=active?active.o.height||floor().height:state.height,base=active?.ref.kind==='solid'?active.o.base:state.base;
  return `<div class="modeling-controls"><div class="seg">${[['rect','画矩形'],['poly','画多边形']].map(([key,label])=>`<button data-solid-shape="${key}" class="${ui.tool==='solid'&&state.shape===key?'active':''}" title="${key==='rect'?'点击两个对角，生成矩形构件':'依次点击角点，点击起点或按 Enter 完成轮廓'}">${label}</button>`).join('')}</div><label class="toolbar-field"><span>构件</span><select id="solidPreset" aria-label="构件预设">${[['column','柱子'],['platform','地台'],['cabinet','柜体'],['custom','自定义']].map(([v,label])=>`<option value="${v}" ${state.preset===v?'selected':''}>${label}</option>`).join('')}</select></label>${n('高度 / m','solidHeight',height,.02,8)}${active?.ref.kind==='wall'?'':n('离地 / m','solidBase',base,0,16)}${state.shape==='poly'&&ui.tool==='solid'?`<span class="modeling-status">角点 ${state.points.length}</span>${btn('undoSolidPoint','撤回一点','撤回上一个角点，也可按 Backspace。',state.points.length?'':'disabled')}${btn('finishSolid','完成轮廓','闭合轮廓并拉起构件，也可按 Enter。',state.points.length>=3?'':'disabled')}`:''}${btn('pullIn3D','三维推拉','在三维中点选墙体或自建构件的顶面、侧面并拖动；也可输入距离。',viewer?'':'disabled')}<span class="modeling-status">${active?'正在编辑：'+esc(active.o.name||(active.ref.kind==='wall'?'墙体':'自建构件')):ui.tool==='solid'?(state.shape==='rect'?(state.points.length?'再点矩形的另一角':'等待矩形起点'):'正在描绘轮廓'):''}</span></div>`;
 }
 function offsetMarkup(){const preview=offsetPreview();return `<div class="modeling-controls"><label class="toolbar-field"><span>生成</span><select id="offsetKind" aria-label="偏移构件类型">${[['ceiling','吊顶边'],['skirting','踢脚线'],['platform','平台边框']].map(([v,label])=>`<option value="${v}" ${state.offsetKind===v?'selected':''}>${label}</option>`).join('')}</select></label>${n('向内偏移 / m','offsetWidth',state.offsetWidth,.005,5,.01)}${n('边框高度 / m','offsetHeight',state.offsetHeight,.02,8,.01)}${n('边框离地 / m','offsetBase',state.offsetBase,0,16)}<label class="toolbar-check"><input id="offsetPreview" type="checkbox" ${state.preview?'checked':''}>显示预览</label>${btn('applyOffset','生成构件','根据橙色预览生成独立构件，原房间保持不变，可撤销。',preview.solid?'':'disabled')}<span class="modeling-status ${preview.error?'has-error':''}" role="status">${esc(preview.error||selected()?.name||'')}</span></div>`;}
 function sectionMarkup(){const s=ui.section,limits=sceneBounds(project(),ui)[s.axis];return `<div class="modeling-controls"><label class="toolbar-field"><span>方向</span><select id="sectionAxis" aria-label="剖切方向">${[['height','水平 · 高度'],['x','竖向 · X'],['y','竖向 · Y']].map(([v,label])=>`<option value="${v}" ${s.axis===v?'selected':''}>${label}</option>`).join('')}</select></label><label class="section-slider"><span>切面位置</span><input id="sectionRange" aria-label="剖切位置滑块" type="range" min="${limits[0]}" max="${limits[1]}" step=".01" value="${s.position}"></label>${n('剖切位置 / m','sectionPosition',s.position,...limits,.01)}${btn('flipSection','保留另一侧','切换剖切后保留的半边空间。','aria-pressed="'+s.flipped+'"')}<label class="toolbar-check"><input id="sectionPlane" type="checkbox" ${s.showPlane?'checked':''}>显示切面</label>${btn('toggleSection',ui.cut?'关闭剖切':'开启剖切','拖动滑块或画面中的蓝色手柄移动切面。','aria-pressed="'+ui.cut+'"')}</div>`;}
 function scenesMarkup(){const scenes=project().scenes||[];if(!scenes.some(s=>s.id===state.sceneId))state.sceneId='';return `<div class="modeling-controls"><label class="toolbar-field scene-name"><span>场景名称</span><input id="sceneName" aria-label="场景名称" maxlength="80" value="${esc(state.sceneName)}"></label>${btn('saveScene','保存当前','保存当前视角、楼层、剖切、隐藏状态、屋顶和显示设置。')}<label class="toolbar-field scene-list"><span>已保存 ${scenes.length} / 50</span><select id="savedScene" aria-label="已保存场景"><option value="">选择场景即可切换</option>${scenes.map(s=>`<option value="${s.id}" ${s.id===state.sceneId?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label>${btn('updateScene','更新此场景','用当前视角和名称更新所选场景。',state.sceneId?'':'disabled')}${btn('deleteScene','删除场景','删除所选场景，可撤销。',state.sceneId?'':'disabled')}<label class="toolbar-check"><input id="sceneRoof" type="checkbox" ${ui.roofVisible?'checked':''}>显示屋顶</label>${btn('scenePNG','导出此视角','将当前三维视角导出为 PNG，不包含切面辅助线。',viewer?'':'disabled')}</div>`;}
 function sync(){
  bar.hidden=!ui.modelingOpen;$('#modelingButton').classList.toggle('active',ui.modelingOpen);$('#modelingButton').setAttribute('aria-expanded',String(ui.modelingOpen));ui.pushPull=ui.modelingOpen&&state.tab==='push'&&ui.tool==='select';if(viewer){viewer.options.pushPull=ui.pushPull;viewer.updateModelingHandles();}
  if(!ui.modelingOpen)return;
  const html=`<div class="modeling-tabs"><div class="seg">${[['push','推拉建模'],['offset','轮廓偏移'],['section','剖切面'],['scenes','视角与场景']].map(([key,label])=>`<button data-modeling-tab="${key}" class="${state.tab===key?'active':''}" aria-pressed="${state.tab===key}">${label}</button>`).join('')}</div>${btn('closeModeling','收起工具','收起建模工具栏；当前剖切和场景显示状态会保留。')}</div>`+({push:pushMarkup,offset:offsetMarkup,section:sectionMarkup,scenes:scenesMarkup}[state.tab])();
  if(html!==cachedMarkup){bar.innerHTML=html;cachedMarkup=html;}
 }
 function open(tab=state.tab){
  state.tab=tab;state.points=[];ui.modelingOpen=true;ui.repairOpen=false;ui.panel='properties';
  setTool(tab==='offset'?'offset':'select',{keepModeling:true});
  if(tab==='section'){setSectionEnabled(true);if(ui.mode==='2d')setMode(innerWidth<700?'3d':'split');}
  sync();renderPlan();
 }
 function startSolid(shape=state.shape){state.shape=shape;state.points=[];ui.sel=null;ui.multi=[];setTool('solid',{keepModeling:true});if(ui.mode==='3d')setMode(innerWidth<700?'2d':'split');sync();}
 function finishSolid(points=state.points){try{const names={column:'柱子',platform:'地台',cabinet:'柜体',custom:'自建构件'},solid=makeSolid(points,{name:names[state.preset],height:state.height,base:state.base,color:state.color});const ok=mutate(()=>{floor().solids??=[];solid.usage=state.preset;floor().solids.push(solid);setSelection([{kind:'solid',id:solid.id}]);});if(ok){state.points=[];setTool('select',{keepModeling:true});toast('构件已生成，点“三维推拉”可拖动顶面和侧面');}}catch(e){toast(e.message);}}
 function pointerDown(e,p){
  if(ui.tool!=='solid')return false;
  if(state.shape==='rect'){if(!state.points.length){state.points=[p];render();}else{try{finishSolid(rectangleContour(state.points[0],p));}catch(error){toast(error.message);}}}
  else{const first=state.points[0];if(first&&state.points.length>=3&&M.dist(first,p)<view.w/Math.max(1,$('#plan').clientWidth)*12)finishSolid();else if(!state.points.length||M.dist(state.points.at(-1),p)>.01){state.points.push({...p});render();}}
  return true;
 }
 function planOverlay(px){
  let html='';if(ui.modelingOpen&&state.tab==='offset'&&state.preview){const p=offsetPreview();if(p.solid)html+=`<path d="${path(p.solid)}" fill="#d9825933" fill-rule="evenodd" stroke="#d98259" stroke-width="${1.5*px}" stroke-dasharray="${6*px} ${4*px}" pointer-events="none" data-modeling-preview="offset"/>`;}
  if(ui.tool==='solid'&&state.points.length){let points=state.points;if(state.shape==='rect'&&ui.pointer){const a=points[0],b=ui.pointer;points=[a,{x:b.x,y:a.y},b,{x:a.x,y:b.y}];}else if(ui.pointer)points=[...points,ui.pointer];html+=`<polygon points="${points.map(p=>p.x+','+p.y).join(' ')}" fill="#4f6d8622" stroke="#4f6d86" stroke-width="${2*px}" stroke-dasharray="${5*px} ${4*px}" pointer-events="none" data-modeling-preview="solid"/>`;html+=state.points.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="${4*px}" fill="white" stroke="#d98259" stroke-width="${2*px}" pointer-events="none"/>`).join('');}return html;
 }
 function setSection(section){ui.section=normalizeSection(section);viewer?.setSection(ui.section,ui.cut);const range=$('#sectionRange'),number=$('#sectionPosition');if(range)range.value=ui.section.position;if(number)number.value=Number(ui.section.position.toFixed(2));}
 function setSectionEnabled(enabled){ui.cut=!!enabled;setSection(ui.section);app.syncChrome();}
 function captureScene(id=crypto.randomUUID()){
  if(!viewer)throw new Error('请等待三维视图启动');
  return validateScene({id,name:state.sceneName.trim()||'场景',camera:viewer.captureCamera(),plan:{...view},view:{mode:ui.mode,floorId:ui.floor,show:ui.show,exploded:ui.exploded,cut:ui.cut,section:ui.section,roofVisible:ui.roofVisible,furniture:ui.furniture,blueprint:ui.blueprint,night:ui.night},visibility:project().floors.flatMap(f=>[...E.entities(f).map(r=>({floorId:f.id,id:r.id,kind:r.kind,hidden:!!r.o.hidden})),...(f.image?[{floorId:f.id,id:f.id,kind:'image',hidden:!!f.image.hidden}]:[])])});
 }
 function applyScene(id){
  const scene=project().scenes?.find(s=>s.id===id);if(!scene)return;const s=M.clone(scene);state.sceneId=id;state.sceneName=s.name;state.points=[];if(viewer?.walk)viewer.stopWalk();
  const restore=()=>{for(const item of s.visibility){const f=project().floors.find(f=>f.id===item.floorId);if(!f)continue;const o=item.kind==='image'?f.image:E.entity(f,item);if(o)o.hidden=item.hidden;}};
  const different=s.visibility.some(item=>{const f=project().floors.find(f=>f.id===item.floorId),o=f&&(item.kind==='image'?f.image:E.entity(f,item));return o&&!!o.hidden!==item.hidden;});if(different)mutate(restore);
  Object.assign(ui,s.view,{floor:project().floors.some(f=>f.id===s.view.floorId)?s.view.floorId:project().floors[0].id,sel:null,multi:[],start:null,tool:'select',repairOpen:false,modelingOpen:true});render();
  requestAnimationFrame(()=>{if(s.plan)Object.assign(view,s.plan);renderPlan();viewer?.resize();viewer?.restoreCamera(s.camera);});
 }
 $('#modelingButton').onclick=()=>{if(ui.modelingOpen)setTool('select');else open();};
 bar.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;try{
  if(b.dataset.modelingTab)return open(b.dataset.modelingTab);if(b.dataset.solidShape)return startSolid(b.dataset.solidShape);
  const actions={closeModeling:()=>setTool('select'),undoSolidPoint:()=>{state.points.pop();render();},finishSolid:()=>finishSolid(),pullIn3D:()=>{setTool('select',{keepModeling:true});if(ui.mode==='2d')setMode(innerWidth<700?'3d':'split');viewer?.markSelection(selectionRefs());toast('点击模型的顶面或侧面推拉；空白处拖动旋转视角');},applyOffset:()=>{const preview=offsetPreview();if(preview.error)throw new Error(preview.error);const solid={...M.clone(preview.solid),id:M.uid()};if(mutate(()=>{floor().solids??=[];solid.usage=state.preset;floor().solids.push(solid);})){state.preview=false;render();toast('已生成 '+solid.name+'，可在构件列表中选择编辑');}},flipSection:()=>{setSection({...ui.section,flipped:!ui.section.flipped});sync();},toggleSection:()=>setSectionEnabled(!ui.cut),saveScene:()=>{if((project().scenes||[]).length>=50)throw new Error('最多保存 50 个场景');const scene=captureScene();if(mutate(()=>{project().scenes??=[];project().scenes.push(scene);})){state.sceneId=scene.id;sync();toast('已保存场景：'+scene.name);}},updateScene:()=>{const scene=captureScene(state.sceneId);mutate(()=>{const index=project().scenes.findIndex(s=>s.id===state.sceneId);if(index>=0)project().scenes[index]=scene;});toast('场景已更新');},deleteScene:()=>{mutate(()=>project().scenes=project().scenes.filter(s=>s.id!==state.sceneId));state.sceneId='';sync();},scenePNG:()=>{if(ui.mode==='2d')setMode('3d');requestAnimationFrame(()=>viewer?.screenshot());}};actions[b.id]?.();
 }catch(error){toast(error.message);}});
 bar.addEventListener('input',e=>{if(e.target.id==='sceneName')state.sceneName=e.target.value;if(e.target.id==='sectionRange')setSection({...ui.section,position:Number(e.target.value)});});
 bar.addEventListener('change',e=>{const el=e.target,value=Number(el.value);try{
  if(el.matches('input[type="number"]')&&(!el.value.trim()||!Number.isFinite(value)||value<Number(el.min)||value>Number(el.max)))throw new Error('请输入范围内的数值');
  if(el.id==='solidPreset'){state.preset=el.value;Object.assign(state,{height:el.value==='column'?floor().height:el.value==='platform'?.2:el.value==='cabinet'?.85:1,base:0,color:el.value==='column'?'#d4cabb':el.value==='platform'?'#c9b797':'#b4c2c9'});startSolid();}
  else if(['solidHeight','solidBase'].includes(el.id)){const key=el.id==='solidHeight'?'height':'base',active=activeHeight();state[key]=value;if(active)mutate(()=>{E.assertEditable(floor(),[active.ref]);active.o[key]=value;});}
  else if(el.id==='offsetKind'){state.offsetKind=el.value;Object.assign(state,el.value==='ceiling'?{offsetWidth:.3,offsetHeight:.15,offsetBase:Math.max(0,floor().height-.15)}:el.value==='skirting'?{offsetWidth:.02,offsetHeight:.1,offsetBase:0}:{offsetWidth:.15,offsetHeight:.2,offsetBase:0});state.preview=true;}
  else if(['offsetWidth','offsetHeight','offsetBase'].includes(el.id)){state[el.id]=value;state.preview=true;}
  else if(el.id==='offsetPreview')state.preview=el.checked;
  else if(el.id==='sectionAxis'){const axis=el.value,limits=sceneBounds(project(),ui)[axis];setSection({...ui.section,axis,position:axis==='height'?M.floorElevation(project(),project().floors.indexOf(floor()))+floor().height/2:(limits[0]+limits[1])/2});}
  else if(el.id==='sectionPosition')setSection({...ui.section,position:value});
  else if(el.id==='sectionPlane')setSection({...ui.section,showPlane:el.checked});
  else if(el.id==='savedScene'){applyScene(el.value);return;}
  else if(el.id==='sceneRoof'){ui.roofVisible=el.checked;render();}
  sync();renderPlan();
 }catch(error){toast(error.message);cachedMarkup='';sync();}});
 document.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select,[contenteditable]')||$('#dialog').open||ui.tool!=='solid')return;let handled=true;if(e.key==='Enter'&&e.target.tagName!=='BUTTON'){if(state.shape==='poly')finishSolid();}else if(['Backspace','Delete'].includes(e.key)||(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){state.points.pop();render();}else if(e.key==='Escape'){state.points=[];setTool('select',{keepModeling:true});}else handled=false;if(handled){e.preventDefault();e.stopImmediatePropagation();}},true);
 if(viewer){viewer.onSectionEdit=setSection;viewer.onPushPullDone=()=>setTool('select');viewer.onPushPullEdit=(stage,ref,face,value)=>{
  if(stage==='start'){try{E.assertEditable(project().floors.find(f=>f.id===ref.floorId),[ref]);pullBefore=M.clone(project());return true;}catch(error){toast(error.message);return false;}}
  if(!pullBefore)return {ok:false,error:'请重新选择推拉面'};
  if(stage==='preview'){try{setProject(applyPushPull(pullBefore,ref,face,value));render();return {ok:true};}catch(error){return {ok:false,error:error.message};}}
  else{const before=pullBefore;pullBefore=null;if(stage==='cancel')setProject(before);else if(JSON.stringify(before)!==JSON.stringify(project())){history(before);changed();}render();}
 };}
 return {sync,open,setSectionEnabled,pointerDown,planOverlay,onTool(t,{keepModeling=false}={}){viewer?.cancelPushPull();if(!keepModeling){ui.modelingOpen=false;state.points=[];}if(t!=='solid')state.points=[];},onFloorChange(){viewer?.cancelPushPull();state.points=[];offsetCache=null;}};
}
