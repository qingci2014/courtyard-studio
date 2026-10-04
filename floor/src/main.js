import './style.css';
import {Viewer} from './viewer.js';
import {MATS,LIB} from './catalog.js';
import {furnSVG} from './furniture-svg.js';
import * as M from './model.js';
import {updateOpening,resizeOpening,doorPose} from './openings.js';
import {connectOpeningEditor} from './opening-viewer.js';
import * as E from './editing.js';
import {selectionTools,objectList,guidePanel} from './editing-panel.js';
import {installModelingTools} from './modeling-tools.js';
import {solidArea} from './modeling.js';
import {createWalkthroughHTML} from './walkthrough-export.js';
import {restoreActiveFloor,nextFloorName,floorContentLabel} from './floor-ui.js';
import {installFurnitureToolbar} from './furniture-toolbar.js';
import {furnitureMetrics} from './assets.js';
import {saveProject,loadProject,saveEditorState,loadEditorState,download,readPlan} from './storage.js';

const icons={cube:'M3 7 12 2l9 5v10l-9 5-9-5V7Zm0 0 9 5 9-5M12 12v10',select:'m5 3 14 9-7 1-3 7L5 3Z',wall:'M3 5h18v14H3V5Zm0 7h18M9 5v7m6 0v7',room:'M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6',door:'M5 21V3h14v18M5 3l10 3v15M11 12h1',window:'M3 4h18v16H3V4Zm9 0v16M3 12h18',stairs:'M2 21h5v-5h5v-5h5V6h5V1',furniture:'M4 11V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5M3 10h3v7h12v-7h3v10H3V10Zm2 10v2m14-2v2',measure:'m3 16 13-13 5 5-13 13-5-5Zm4-4 3 3m0-6 3 3m0-6 3 3',pan:'M8 13V5a2 2 0 0 1 4 0v7-9a2 2 0 0 1 4 0v9-6a2 2 0 0 1 4 0v8c0 6-3 8-7 8-3 0-5-3-8-7-2-3 0-5 2-3l1 1',upload:'M12 16V3m-5 5 5-5 5 5M3 15v5a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-5',download:'M12 3v13m-5-5 5 5 5-5M3 16v4a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-4',undo:'M3 10h11a6 6 0 0 1 0 12M3 10l5-5m-5 5 5 5',redo:'M21 10H10a6 6 0 0 0 0 12m17-12-5-5m5 5-5 5',fit:'M3 8V3h5m8 0h5v5m0 8v5h-5m-8 0H3v-5',plus:'M12 4v16M4 12h16',minus:'M4 12h16',layers:'m2 7 10-5 10 5-10 5L2 7Zm0 5 10 5 10-5M2 17l10 5 10-5',walk:'M14 4a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM7 12l2-5h5l2 6h4m-8-6-2 8-4 7m4-7 5 3 1 4',play:'m7 3 14 9-14 9V3Z',top:'M4 4h16v16H4V4Zm4 4h8v8H8V8Z',help:'M9 8a3 3 0 1 1 4 3v3m0 3v1M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z',settings:'M4 6h16M4 12h16M4 18h16M9 3v6m6 0v6m-7 0v6',save:'M4 3h13l4 4v14H3V3h1Zm3 0v6h10V3M7 21v-8h10v8',image:'M3 3h18v18H3V3Zm0 13 6-6 5 5 3-3 4 4M16 7h1',scan:'M3 8V3h5m8 0h5v5m0 8v5h-5m-8 0H3v-5M6 12h12',trash:'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',copy:'M8 8h13v13H8V8ZM16 8V3H3v13h5',chevron:'m8 5 7 7-7 7'};
const ico=(name)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name]||icons.cube}"/></svg>`;
icons.split='M3 6h6v12H3V6Zm12 0h6v12h-6V6ZM12 3v3m0 4v4m0 4v3';
icons.connect='M3 7h5v10H3V7Zm13 0h5v10h-5V7ZM8 12h8m-6-2-2 2 2 2m4-4 2 2-2 2';
icons.rotate='M20 11a8 8 0 1 0-2.3 6M20 4v7h-7';
icons.close='m6 6 12 12M18 6 6 18';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
let project=M.blankProject(),saveOnStart=false,editorState=null;
try{const stored=await loadProject();if(stored){project=M.validateProject(stored);saveOnStart=project.floors.some((f,i)=>f.name!==stored.floors[i]?.name);}else saveOnStart=true;}catch(e){console.warn('恢复项目失败',e);}
try{editorState=await loadEditorState();}catch(e){console.warn('恢复编辑位置失败',e);}
const ui={floor:restoreActiveFloor(project,editorState),mode:innerWidth<700?'3d':'split',tool:'select',sel:null,start:null,pointer:null,grid:true,dims:false,snap:true,library:false,category:0,exploded:false,cut:false,furniture:true,blueprint:true,night:false,show:'all',measure:null};
const view={x:-2,y:-2,w:16,h:13};let viewer,modeling,undoStack=[],redoStack=[],saveTimer,dirty=false,saveChain=Promise.resolve(),draftBefore=null,drag=null,activeDialog=null;
const floor=()=>project.floors.find(f=>f.id===ui.floor)||project.floors[0];
const selected=()=>{if(!ui.sel)return null;return E.entity(floor(),ui.sel);};
ui.multi=[];ui.panel='properties';ui.objectFilter='all';ui.guideAxis='x';ui.boxFilter='furniture';
function selectionRefs(){if(!ui.sel||!selected())return [];return ui.multi.some(r=>r.id===ui.sel.id&&r.floorId===ui.floor)?ui.multi.filter(r=>E.entity(floor(),r)):E.expandSelection(floor(),[ui.sel]);}
function setSelection(refs){ui.multi=refs.map(r=>({...r,floorId:ui.floor}));ui.sel=ui.multi.at(-1)||null;}
function choose(ref,add=false){const refs=E.expandSelection(floor(),[ref]),current=selectionRefs(),ids=new Set(refs.map(r=>r.id));setSelection(add?(refs.every(r=>current.some(q=>q.id===r.id))?current.filter(r=>!ids.has(r.id)):[...current.filter(r=>!ids.has(r.id)),...refs]):refs);ui.library=false;}
const toolNames={select:'选择',wall:'画墙',room:'房间',door:'门',window:'窗',stairs:'楼梯',furniture:'家具',measure:'测量',pan:'平移',calibrate:'校准',crop:'识别范围',repair:'手动修复'};
$('#app').innerHTML=`<header class="topbar"><nav class="floorbar" aria-label="楼层与编辑工具"><div class="floor-controls"><div class="floor-tabs" id="floorTabs"></div><button class="btn small icon" id="addFloor" title="添加楼层" aria-label="添加楼层">${ico('plus')}</button></div><div class="right"><button id="help" class="extra">操作指南</button><div class="seg" id="viewSeg"><button data-view="2d">平面</button><button data-view="split">双视图</button><button data-view="3d">三维</button></div></div></nav><div class="top-actions"><button class="btn icon history-btn" id="undo" title="撤销 Ctrl+Z" aria-label="撤销">${ico('undo')}</button><button class="btn icon history-btn" id="redo" title="重做 Ctrl+Shift+Z" aria-label="重做">${ico('redo')}</button><button class="btn" id="importPlan" aria-label="导入图纸">${ico('upload')}<span>导入图纸</span></button><div class="menu-wrap"><button class="btn" id="fileMenu" aria-label="项目文件">${ico('save')}<span>项目</span></button><div id="filePopup" class="popup" hidden><label class="field project-name-field"><span>项目名称</span><input id="projectName" aria-label="项目名称" maxlength="80"></label><div class="sep"></div><button data-file="new">新建空白建筑</button><button data-file="villa">打开两层住宅样例</button><button data-file="reference">打开原 /floor 样例</button><div class="sep"></div><button data-file="save">保存项目 JSON</button><button data-file="open">打开项目 JSON</button></div></div><div class="menu-wrap"><button class="btn primary" id="exportMenu" aria-label="导出文件">${ico('download')}<span>导出</span></button><div id="exportPopup" class="popup" hidden><button data-export="html">漫游网页 · HTML（离线）</button><button data-export="glb">三维模型 · GLB</button><button data-export="stl">三角网格 · STL（米）</button><button data-export="png">当前三维截图 · PNG</button><button data-export="svg">当前楼层平面 · SVG</button></div></div><button class="btn icon inspector-toggle" id="toggleInspector" aria-label="属性面板">${ico('settings')}</button></div></header>
<main class="workspace"><aside class="rail" aria-label="建模工具">${['select','wall','room','door','window','stairs','furniture'].map(t=>`<button class="tool" data-tool="${t}" title="${toolNames[t]}" aria-label="${toolNames[t]}">${ico(t==='stairs'?'stairs':t)}<span>${toolNames[t]}</span></button>`).join('')}<div class="rail-sep"></div>${['measure','pan'].map(t=>`<button class="tool" data-tool="${t}" title="${toolNames[t]}" aria-label="${toolNames[t]}">${ico(t)}<span>${toolNames[t]}</span></button>`).join('')}<button class="tool" id="railHelp" title="帮助" style="margin-top:auto">${ico('help')}</button></aside>
<div class="views" id="views"><section class="pane plan-pane"><div class="pane-heading"><strong>平面编辑</strong><span id="floorLabel"></span></div><svg id="plan" xmlns="http://www.w3.org/2000/svg" aria-label="二维建筑编辑画布"></svg><div id="calibrationGuide" class="calibration-guide" hidden aria-live="polite"></div><div id="emptyHint" class="hint-empty" hidden><b>从一面墙开始</b>选择「画墙」连续点选，或导入图纸描绘</div><div class="canvas-controls"><button data-plan="out" title="缩小">${ico('minus')}</button><button data-plan="in" title="放大">${ico('plus')}</button><button data-plan="fit" title="适应画布">${ico('fit')}</button><button data-plan="grid">网格</button><button data-plan="dims">尺寸</button><button data-plan="snap">吸附</button></div></section><section class="pane three-pane"><div class="pane-heading"><strong>三维空间</strong><span id="threeLabel">整栋</span></div><div class="view-actions"><button class="btn small" id="showAll" title="整栋 / 当前层">${ico('layers')}<span>整栋</span></button><button class="btn small" id="explode" title="楼层分离">${ico('layers')}<span>分层</span></button><button class="btn small" id="replay" title="播放搭建动画">${ico('play')}<span>搭建</span></button><button class="btn small primary" id="walk" title="进入当前楼层漫游">${ico('walk')}<span>漫游</span></button></div><div class="three-canvas" id="three"></div><div class="canvas-controls" id="threeControls"><button id="fit3d" title="适应视角">${ico('fit')}</button><button id="top3d" title="俯视">${ico('top')}</button><button id="cut3d" aria-pressed="false">剖切</button><button id="furniture3d">家具</button><button id="night3d">夜景</button></div><div class="view-caption">左键旋转 · 右键平移 · 滚轮缩放</div><div class="walkbar" id="walkbar"><div class="pad"><i></i><button data-key="KeyW" aria-label="向前">↑</button><i></i><button data-key="KeyA" aria-label="向左">←</button><button data-key="KeyS" aria-label="向后">↓</button><button data-key="KeyD" aria-label="向右">→</button></div><span>拖动画面转向 · WASD 移动<br>点门开关 · 走上楼梯换层</span><button class="btn" id="exitWalk">退出漫游</button></div></section></div><aside class="inspector" id="inspector"></aside></main>
<footer class="statusbar"><span id="hint"></span><span class="save-label" id="saveState" role="status">保存在此浏览器</span><span class="shortcuts"><kbd>V</kbd>选择　<kbd>W</kbd>画墙　<kbd>Esc</kbd>结束　<kbd>Del</kbd>删除　单位：m</span></footer><div class="toast" id="toast" role="status"></div><input hidden type="file" id="projectFile" accept=".json,application/json"><input hidden type="file" id="planFile" accept="image/png,image/jpeg,image/webp,application/pdf,.pdf,.dxf,.dwg"><dialog id="dialog"></dialog>`;
$('#plan').insertAdjacentHTML('afterend','<div id="snapStatus" class="snap-status" role="status" hidden></div>');
const furnitureToolbar=installFurnitureToolbar({$,ui,floor,selectionRefs,setSelection,mutate,runEdit,ico});
$('#inspector').before($('.rail'));
$('#views').insertAdjacentHTML('beforebegin','<div class="canvas-workspace"><section id="repairToolbar" class="repair-toolbar" aria-label="手动修复工具" hidden></section></div>');
$('.canvas-workspace').append($('#views'));
$('#app').insertAdjacentHTML('beforeend','<div id="repairTooltip" class="repair-tooltip" role="tooltip" hidden></div>');
$('#addFloor').insertAdjacentHTML('afterend','<div class="plan-tools" aria-label="平面编辑工具"><button id="repairPlan" class="btn small plan-repair" aria-expanded="false" aria-controls="repairToolbar">手动修复</button></div>');
ui.repairOpen=false;ui.repairMode='floor';ui.repairPoints=[];ui.repairEnds=[];
$('#repairPlan').insertAdjacentHTML('afterend','<button id="boxSelect" class="btn small plan-repair">框选</button><button id="guideTool" class="btn small plan-repair">参考线</button>');
$('.floorbar .right').insertAdjacentHTML('afterbegin','<button id="objectListButton" class="btn small">构件列表</button>');
$('#objectListButton').onclick=()=>{ui.panel='objects';setTool('select');$('#inspector').classList.add('open');};
$('#boxSelect').onclick=()=>{setTool('box');ui.panel='properties';renderInspector();};
$('#guideTool').onclick=()=>{ui.panel='properties';setTool('guide');$('#inspector').classList.add('open');};
$('#repairPlan').onclick=()=>{if(ui.repairOpen){setTool('select');return;}ui.sel=null;ui.panel='properties';ui.repairPoints=[];ui.repairEnds=[];setTool('repair');};
try{viewer=new Viewer($('#three'),(s,event)=>{ui.floor=s.floorId;if(E.locked(floor(),s))return;choose(s,event?.shiftKey);ui.snapFeedback=null;renderPlan();renderInspector();syncChrome();viewer.markSelection(selectionRefs());},walking=>{$('#walkbar').classList.toggle('active',walking);$('#threeControls').hidden=walking;$$('.view-actions button').forEach(b=>b.disabled=walking);if(!walking)syncChrome();});}catch(e){console.error(e);$('#three').innerHTML='<div class="error-card"><b>三维画面未能启动</b><span class="muted">请在支持 WebGL 的 Chrome 或 Edge 中打开。平面编辑仍可使用。</span></div>';}

connectOpeningEditor(viewer,{getProject:()=>project,setProject:p=>project=p,history,changed,render,toast});
modeling=installModelingTools({$,ui,view,viewer,getProject:()=>project,setProject:p=>project=p,floor,selected,selectionRefs,setSelection,setTool,setMode,render,renderPlan,mutate,history,changed,toast,esc,syncChrome});

function toast(msg){$('#toast').textContent=msg;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),3800);}
function history(before){undoStack.push(before);if(undoStack.length>50)undoStack.shift();redoStack=[];}
function changed(){dirty=true;$('#saveState').textContent='正在保存…';clearTimeout(saveTimer);saveTimer=setTimeout(()=>{const snapshot=M.clone(project),state={projectId:project.id,floorId:ui.floor};saveChain=saveChain.catch(()=>{}).then(()=>saveProject(snapshot,state)).then(()=>{dirty=false;$('#saveState').textContent='已保存到此浏览器';}).catch(e=>{console.error(e);$('#saveState').textContent='保存失败，请导出项目';toast('浏览器存储不足或不可用，请用“项目 → 保存项目 JSON”备份');});},450);}
function rememberFloor(){
 const state={projectId:project.id,floorId:ui.floor};
 if(editorState?.projectId===state.projectId&&editorState?.floorId===state.floorId)return;
 editorState=state;
 saveChain=saveChain.catch(()=>{}).then(()=>saveEditorState(state)).catch(e=>{console.warn('保存编辑位置失败',e);if(editorState===state)editorState=null;});
}
function mutate(fn,{rooms=false}={}){const before=M.clone(project);ui.snapFeedback=null;try{fn();M.normalizeOpenings(floor());if(rooms)floor().rooms=M.refreshRooms(floor());M.normalizeEmptyFloorName(project);E.assertLocksPreserved(before,project);history(before);changed();render();return true;}catch(e){project=before;toast(e.message);render();return false;}}
function undo(){if(!undoStack.length)return;redoStack.push(M.clone(project));project=undoStack.pop();afterHistory();}
function redo(){if(!redoStack.length)return;undoStack.push(M.clone(project));project=redoStack.pop();afterHistory();}
function afterHistory(){ui.floor=project.floors.some(f=>f.id===ui.floor)?ui.floor:project.floors[0].id;ui.sel=null;ui.start=null;ui.snapFeedback=null;changed();render();}
function render(){renderPlan();renderInspector();syncChrome();viewer?.update(project,{...ui,floor:ui.show==='all'?'all':ui.floor});viewer?.markSelection(selectionRefs());}
function syncChrome(){
 viewer?.setInteractionTool(ui.tool);$('.view-caption').textContent=ui.tool==='pan'?'左键拖动平移 · 滚轮缩放':'左键旋转 · 右键平移 · 滚轮缩放';
 rememberFloor();
 $('#projectName').value=project.name;$('#views').dataset.mode=ui.mode;$('#floorLabel').textContent=floor().name;$('#threeLabel').textContent=(ui.show==='all'?'整栋建筑':floor().name)+(project.floors.some(f=>f.image&&!f.image.calibrated&&f.walls.length)?' · 尺寸待校准':'');
 $('#floorTabs').innerHTML=project.floors.map((f,i)=>`<button class="floor-tab ${f.id===ui.floor?'active':''}" data-floor="${f.id}" aria-pressed="${f.id===ui.floor}" title="${esc(f.name)} · 楼面高度 ${M.floorElevation(project,i).toFixed(2)} m">${esc(f.name)}</button>`).join('');
 $$('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===ui.tool));$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===ui.mode));$('#undo').disabled=!undoStack.length;$('#redo').disabled=!redoStack.length;
 for(const k of['grid','dims','snap']){const b=$(`[data-plan="${k}"]`);b.classList.toggle('active',ui[k]);b.setAttribute('aria-pressed',String(ui[k]));}$('#explode').classList.toggle('active',ui.exploded);$('#cut3d').classList.toggle('active',ui.cut);$('#cut3d').setAttribute('aria-pressed',String(ui.cut));$('#cut3d').title=ui.cut?'关闭剖切，显示完整模型':'开启剖切并调整切面';$('#furniture3d').classList.toggle('active',ui.furniture);$('#night3d').classList.toggle('active',ui.night);$('#showAll').classList.toggle('active',ui.show==='all');
 $('[data-plan="snap"]').title=ui.snap?'吸附已开启：家具贴墙、家具对齐、墙角墙线和 0.1 m 网格':'吸附已关闭：自由移动';
 const hints={select:'点击墙、门窗或家具查看属性；拖动可移动，选中墙端点可调整长度',wall:'点选起点与终点，连续画墙；Esc 结束；按住 Shift 锁定水平 / 垂直',room:'点选房间的两个对角，生成闭合墙体',door:'点击墙体放门；在右侧调整宽度、高度和位置',window:'点击墙体放窗；在右侧调整窗宽、窗高和窗台高度',stairs:'点击平面放置直跑楼梯；在右侧调整位置、长度和方向',furniture:'选择右侧家具，再点击平面放置',measure:'点选两点测量实际距离',calibrate:'跟随画面提示点选尺寸线两端；不知道尺寸可以先识别预览',crop:'在图纸上点选识别区域的两个对角',pan:'拖动平移；滚轮缩放',repair:'手动修复 · 依次点选边界或墙端点 · Enter 完成 · Backspace 撤回一点 · Esc 退出'};$('#hint').textContent=hints[ui.tool]||hints.select;
 if(ui.tool==='select'&&ui.sel?.kind==='opening')$('#hint').textContent='拖洞口两端改宽度 · 三维 S 缩放、M 移动 · 翻转调整开启方向 · Ctrl+Z 撤销';
 if(ui.tool==='select'&&ui.sel?.kind==='furniture')$('#hint').textContent='拖家具移动 · 拖四角等比缩放 · 拖边中点改宽度或进深 · Ctrl+Z 撤销';
 if(ui.tool==='box')$('#hint').textContent='拖框选择完全在框内的构件 · Shift 追加选择 · 可在右侧筛选家具或墙体';
 if(ui.tool==='guide')$('#hint').textContent='点击添加参考线 · 拖动参考线调整位置 · 右侧可输入毫米数值';
 if(ui.tool==='select'&&selectionRefs().length>1)$('#hint').textContent='已选 '+selectionRefs().length+' 项 · 拖动任一选中构件整体移动 · 右侧成组、旋转、镜像或复制';
 $('#boxSelect').classList.toggle('active',ui.tool==='box');$('#guideTool').classList.toggle('active',ui.tool==='guide');
 renderRepairToolbar();modeling?.sync();
 if(ui.pushPull)$('.view-caption').textContent='拖面推拉 · 空白处旋转 · 右键平移 · 滚轮缩放';
 furnitureToolbar.sync();
 viewer?.resize();
}
function fitPlan(){const b=M.bounds(floor(),true),rect=$('#plan').getBoundingClientRect(),aspect=(rect.width||500)/(rect.height||650),pad=1.8;let w=b.w+pad*2,h=b.h+pad*2;if(w/h<aspect)w=h*aspect;else h=w/aspect;view.x=b.x+b.w/2-w/2;view.y=b.y+b.h/2-h/2;view.w=w;view.h=h;renderPlan();}
function setMode(mode){ui.mode=mode;syncChrome();requestAnimationFrame(()=>{fitPlan();viewer?.resize();});}
function setFloor(id){viewer?.cancelOpeningEdit();modeling?.onFloorChange();if(viewer?.walk)viewer.stopWalk();ui.floor=id;ui.sel=null;ui.start=null;ui.repairPoints=[];ui.repairEnds=[];ui.snapFeedback=null;render();fitPlan();if(ui.show!=='all')viewer?.fit();}
function setTool(t,{keepRepair=false,keepModeling=false}={}){viewer?.cancelOpeningEdit();modeling?.onTool(t,{keepModeling});if(!keepRepair)ui.repairOpen=t==='repair';if(t!=='repair'){ui.repairPoints=[];ui.repairEnds=[];}ui.tool=t;ui.start=null;ui.pointer=null;ui.snapFeedback=null;ui.library=t==='furniture';if(['solid','offset'].includes(t)&&innerWidth<700)setMode('2d');if(t==='calibrate'){setMode('2d');$('#inspector').classList.remove('open');}else if(['box','guide','solid','offset','wall','room','door','window','stairs','measure','calibrate','crop','furniture','repair'].includes(t)&&ui.mode==='3d')setMode(innerWidth<700?'2d':'split');syncChrome();renderPlan();renderInspector();}
function svgText(x,y,text,size,extra=''){return`<text x="${x}" y="${y}" font-size="${size}" font-family="Segoe UI,Microsoft YaHei,sans-serif" text-anchor="middle" ${extra}>${esc(text)}</text>`;}
function renderRepairToolbar(){
 const bar=$('#repairToolbar'),mode=ui.tool==='repair'?ui.repairMode:ui.tool==='wall'?'draw':'edit',count=ui.repairPoints.length;
 bar.hidden=!ui.repairOpen;$('#repairPlan').classList.toggle('active',ui.repairOpen);$('#repairPlan').setAttribute('aria-expanded',String(ui.repairOpen));
 if(!ui.repairOpen){hideRepairTooltip();return;}
 const modes=[
  ['split','断开墙','split','点击墙段上的断开位置，将墙切成两段。请避开门窗所在的位置。'],
  ['connect','连接墙','connect','依次点击两面墙的端点，再点“连接两端”或按 Enter。相向的墙角沿原方向补齐，其他端点用墙段连接。'],
  ['draw','补画墙','wall','依次点击起点和终点补画墙体，可连续绘制。按住 Shift 锁定水平或垂直，Esc 结束。'],
  ['floor','补地面','room','沿大厅或走廊边界逐点点击，点击起点或按 Enter 完成。只补地面，不会新增墙体；已有房间会保留。'],
  ['edit','调整墙','select','选中墙体后拖动墙或端点调整，按 Delete 删除。也可选择手工地面分区，拖动角点修改轮廓。']
 ];
 let current='';
 if(mode==='floor')current=`<span class="repair-progress" role="status">角点 <b>${count}</b>${count>=3?' · '+M.area(ui.repairPoints.map(p=>[p.x,p.y])).toFixed(1)+' m²':''}</span><button class="btn small" id="undoRepairPoint" data-repair-tip="撤回上一个角点，也可按 Backspace 或 Ctrl+Z。" ${!count?'disabled':''}>撤回一点</button><button class="btn small primary" id="finishRoomRepair" data-repair-tip="至少点选 3 个角点后完成分区，也可按 Enter。" ${count<3?'disabled':''}>完成分区</button>`;
 if(mode==='connect')current=`<span class="repair-progress" role="status">端点 <b>${ui.repairEnds.length}</b> / 2</span><button class="btn small" id="clearRepairEnds" data-repair-tip="清除已选端点，重新选择两面墙的端点。" ${!ui.repairEnds.length?'disabled':''}>重选</button><button class="btn small primary" id="finishWallConnection" data-repair-tip="连接选中的两个墙端点，保留原有门窗；也可按 Enter。" ${ui.repairEnds.length!==2?'disabled':''}>连接两端</button>`;
 const html=`<div class="repair-tools" role="group" aria-label="修复方式">${modes.map(([key,label,icon,tip])=>`<button class="btn small repair-mode ${mode===key?'active':''}" data-repair-mode="${key}" data-repair-tip="${esc(tip)}" aria-pressed="${mode===key}">${ico(icon)}${label}</button>`).join('')}<span class="repair-divider" aria-hidden="true"></span><button class="btn small" id="autoRepairRooms" data-repair-tip="尝试补全闭合墙线围成的遗漏分区，保留已有房间。操作支持撤销。">${ico('scan')}自动补分区</button></div><div class="repair-current">${current}<button class="btn small" id="cancelRoomRepair" data-repair-tip="退出手动修复并收起工具栏，也可按 Esc。未完成的角点和端点选择会清除。">退出修复</button></div>`;
 if(bar.innerHTML!==html){hideRepairTooltip();bar.innerHTML=html;}
}
let repairTipTarget=null;
function hideRepairTooltip(){repairTipTarget?.removeAttribute('aria-describedby');repairTipTarget=null;$('#repairTooltip').hidden=true;}
function showRepairTooltip(button){
 hideRepairTooltip();const tip=$('#repairTooltip');repairTipTarget=button;tip.textContent=button.dataset.repairTip;tip.hidden=false;button.setAttribute('aria-describedby','repairTooltip');
 const anchor=button.getBoundingClientRect(),box=tip.getBoundingClientRect();tip.style.left=Math.max(8,Math.min(anchor.left,innerWidth-box.width-8))+'px';tip.style.top=(anchor.bottom+box.height+8<innerHeight?anchor.bottom+8:Math.max(8,anchor.top-box.height-8))+'px';
}
$('#repairToolbar').addEventListener('pointerover',e=>{const b=e.target.closest('[data-repair-tip]');if(b&&b!==repairTipTarget)showRepairTooltip(b);});
$('#repairToolbar').addEventListener('pointerout',e=>{if(repairTipTarget&&!repairTipTarget.contains(e.relatedTarget))hideRepairTooltip();});
$('#repairToolbar').addEventListener('pointerdown',hideRepairTooltip);
$('#repairToolbar').addEventListener('focusin',e=>{const b=e.target.closest('[data-repair-tip]');if(b?.matches(':focus-visible'))showRepairTooltip(b);});
$('#repairToolbar').addEventListener('focusout',hideRepairTooltip);
window.addEventListener('resize',hideRepairTooltip);
function finishRoomRepair(){
 try{const room=M.manualRoom(floor(),ui.repairPoints);mutate(()=>{floor().rooms.push(room);ui.sel={kind:'room',id:room.id,floorId:ui.floor};});ui.repairPoints=[];setTool('select',{keepRepair:true});toast('地面分区已补好，可改名、换材质或拖动角点调整');}catch(e){toast(e.message);}
}
function repairPointer(e,p){
 if(ui.repairMode==='floor'){
  const first=ui.repairPoints[0],threshold=view.w/Math.max(1,$('#plan').clientWidth)*12;
  if(first&&M.dist(first,p)<threshold&&ui.repairPoints.length>=3){finishRoomRepair();return;}
  if(!ui.repairPoints.length||M.dist(ui.repairPoints.at(-1),p)>.03)ui.repairPoints.push({...p});
 }else if(ui.repairMode==='split'){
  const ent=e.target.closest('[data-kind="wall"]'),hit=ent?{wall:floor().walls.find(w=>w.id===ent.dataset.id)}:M.nearestWall(p,{...floor(),walls:floor().walls.filter(w=>!w.hidden&&!w.locked)},view.w/Math.max(1,$('#plan').clientWidth)*9);
  if(!hit?.wall){toast('请点击墙段上的断开位置');return;}
  mutate(()=>{E.assertEditable(floor(),[{kind:'wall',id:hit.wall.id}]);M.splitWall(floor(),hit.wall.id,p);},{rooms:true});
 }else{
  const el=e.target.closest('[data-kind="repair-end"]');if(!el){toast('请点击墙端的圆点');return;}
  const next={id:el.dataset.id,end:el.dataset.end};
  if(ui.repairEnds.some(q=>q.id===next.id&&q.end===next.end))ui.repairEnds=ui.repairEnds.filter(q=>q.id!==next.id||q.end!==next.end);
  else if(ui.repairEnds.length<2)ui.repairEnds.push(next);
  else ui.repairEnds=[next];
 }renderPlan();renderInspector();syncChrome();
}
function handleRepairClick(e){
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.repairMode){const mode=b.dataset.repairMode;ui.sel=null;ui.panel='properties';ui.repairPoints=[];ui.repairEnds=[];if(['draw','edit'].includes(mode))setTool(mode==='draw'?'wall':'select',{keepRepair:true});else{ui.repairMode=mode;setTool('repair');}return;}
 const actions={finishRoomRepair,undoRepairPoint:()=>{ui.repairPoints.pop();render();},cancelRoomRepair:()=>{ui.repairPoints=[];ui.repairEnds=[];setTool('select');},clearRepairEnds:()=>{ui.repairEnds=[];render();},finishWallConnection:()=>{if(ui.repairEnds.length===2)mutate(()=>{M.connectWallEnds(floor(),...ui.repairEnds);ui.repairEnds=[];},{rooms:true});},autoRepairRooms:()=>{const rooms=M.missingRooms(floor());if(!rooms.length)return toast('未找到可闭合的分区，可以手动画地面或补画缺失墙体');mutate(()=>floor().rooms.push(...rooms));toast(`已补全 ${rooms.length} 个地面分区`);},repairDrawWall:()=>setTool('wall'),repairEditWall:()=>setTool('select'),editRoomContour:()=>{mutate(()=>selected().manual=true);toast('拖动橙色角点调整分区边界');},deleteRoomContour:()=>{mutate(()=>{floor().rooms=floor().rooms.filter(r=>r.id!==ui.sel.id);ui.sel=null;});}};
 actions[b.id]?.();
}
$('#repairToolbar').addEventListener('click',handleRepairClick);
$('#inspector').addEventListener('click',handleRepairClick);
function renderCalibrationGuide(){
 const guide=$('#calibrationGuide');
 const active=ui.tool==='calibrate'&&!!floor().image;
 guide.hidden=!active;
 if(!active){delete guide.dataset.step;return;}
 const step=ui.start?'2':'1';
 if(guide.dataset.step===step)return;
 guide.dataset.step=step;
 guide.innerHTML='<strong>'+ (ui.start?'② 再点击这段长度的另一端':'① 点击图上已知长度的起点')+'</strong><p>找图上标有数字的一段尺寸线，点击它对应的两个端点。接着直接输入图上的数字。</p><div class="calibration-example" aria-label="示例：尺寸线两端标为 1 和 2，中间标注 6000 毫米"><i>1</i><span>← 示例：6000 →</span><i>2</i></div><div class="guide-actions"><button class="btn small primary" id="skipCalibration">不知道尺寸，先识别</button><button class="btn small" id="cancelCalibration">取消</button></div>';
 $('#skipCalibration').onclick=()=>{setTool('select');recognizeDialog();};
 $('#cancelCalibration').onclick=()=>setTool('select');
}
function renderPlan(){
 const f=floor(),svg=$('#plan'),r=svg.getBoundingClientRect(),scale=(r.width||500)/view.w,px=1/scale,sel=ui.sel,refs=selectionRefs(),chosen=new Set(refs.map(r=>r.id)),editable=refs.length===1&&!E.locked(f,refs[0]);svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);svg.dataset.tool=ui.tool;
 let s=`<defs><pattern id="gridMinor" width=".1" height=".1" patternUnits="userSpaceOnUse"><path d="M .1 0 L 0 0 0 .1" fill="none" stroke="#e9e5df" stroke-width="${.3*px}"/></pattern><pattern id="gridMajor" width="1" height="1" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="url(#gridMinor)"/><path d="M1 0H0V1" fill="none" stroke="#ddd8d0" stroke-width="${.65*px}"/></pattern></defs><rect x="${view.x}" y="${view.y}" width="${view.w}" height="${view.h}" fill="${ui.grid?'url(#gridMajor)':'#f1efeb'}"/>`;
 if(f.image&&!f.image.hidden&&ui.blueprint){const i=f.image;s+=`<image href="${i.data}" x="${i.x}" y="${i.y}" width="${i.width}" height="${i.width*i.pixelHeight/i.pixelWidth}" opacity="${i.opacity}" pointer-events="none"/>`;}
 if(f.cad&&!f.cad.hidden&&ui.blueprint)s+=`<path class="cad-underlay" d="${f.cad.segments.map(s=>'M'+s.a.x+','+s.a.y+'L'+s.b.x+','+s.b.y).join('')}" fill="none" stroke="#87929b" stroke-width="${px}" opacity=".55" pointer-events="none"/>`;
 const previous=project.floors[project.floors.indexOf(f)-1];if(previous)for(const st of previous.stairs){const poly=viewer?.stairPolygon(st)||[];s+=`<polygon points="${poly.map(p=>p.join(',')).join(' ')}" fill="#efe9d5" stroke="#bdb499" stroke-dasharray="${4*px} ${3*px}" stroke-width="${px}" pointer-events="none"/>`;}
 for(const room of f.rooms.filter(r=>!r.hidden)){const selected=chosen.has(room.id),center=M.roomLabelPoint(room.poly);s+=`<polygon class="entity" data-kind="room" data-id="${room.id}" points="${room.poly.map(p=>p.join(',')).join(' ')}" fill="${MATS[room.mat]?.sw||'#ece6dc'}" fill-opacity="${selected?.65:.32}" stroke="${selected?'#d98259':'none'}" stroke-width="${2*px}"/>`;s+=svgText(center.x,center.y-.1,room.name,Math.min(.32,12*px),'fill="#6b7178" pointer-events="none"');s+=svgText(center.x,center.y+.28,M.area(room.poly).toFixed(1)+' m²',Math.min(.25,10*px),'fill="#94989e" pointer-events="none"');}
 for(const solid of (f.solids||[]).filter(o=>!o.hidden)){const selected=chosen.has(solid.id),d=[solid.poly,...(solid.holes||[])].map(poly=>'M'+poly.map(p=>p.join(',')).join('L')+'Z').join(' ');s+=`<path class="entity solid-shape" data-kind="solid" data-id="${solid.id}" d="${d}" fill-rule="evenodd" fill="${solid.color}" fill-opacity=".65" stroke="${selected?'#d98259':'#8a8277'}" stroke-width="${(selected?2:1)*px}"/>`;if(selected){const p=M.roomLabelPoint(solid.poly);s+=svgText(p.x,p.y,esc(solid.name)+' · '+solid.height.toFixed(2)+' m',11*px,'fill="#ad694d" pointer-events="none"');}}
 for(const w of f.walls.filter(w=>!w.hidden)){const selected=chosen.has(w.id);const stroke=selected?'#d98259':'#6b7178';s+=`<line class="entity wall-shape" data-kind="wall" data-id="${w.id}" x1="${w.a.x}" y1="${w.a.y}" x2="${w.b.x}" y2="${w.b.y}" stroke="${stroke}" stroke-width="${w.thickness}"/>`;if(ui.dims||selected){const x=(w.a.x+w.b.x)/2,y=(w.a.y+w.b.y)/2,a=Math.atan2(w.b.y-w.a.y,w.b.x-w.a.x)*180/Math.PI;s+=`<g transform="translate(${x},${y}) rotate(${a>90||a< -90?a+180:a})" pointer-events="none"><rect x="${-25*px}" y="${-w.thickness/2-20*px}" width="${50*px}" height="${16*px}" rx="${3*px}" fill="#fbfaf8"/>${svgText(0,-w.thickness/2-8*px,M.length(w).toFixed(2)+'m',10*px,'fill="#8a8f96"')}</g>`;}}
 for(const o of f.openings.filter(o=>!E.hidden(f,{kind:'opening',id:o.id}))){const w=f.walls.find(w=>w.id===o.wallId);if(!w)continue;const p=M.onWall(w,o.offset),a=Math.atan2(w.b.y-w.a.y,w.b.x-w.a.x)*180/Math.PI,c=chosen.has(o.id)?'#d98259':o.type==='window'?'#91a2af':'#b4935f';s+=`<g class="entity" data-kind="opening" data-id="${o.id}" transform="translate(${p.x},${p.y}) rotate(${a})"><rect x="${-o.width/2}" y="${-w.thickness/2-.015}" width="${o.width}" height="${w.thickness+.03}" fill="#f1efeb" stroke="${c}" stroke-width="${(chosen.has(o.id)?2:1)*px}"/>`;if(o.type==='window')s+=`<path d="M${-o.width/2} -.03h${o.width}M${-o.width/2} .03h${o.width}" stroke="${c}" stroke-width="${px}"/>`;else s+=`<path transform="scale(${doorPose(o).hinge},${doorPose(o).swing})" d="M${-o.width/2} 0v${-o.width}M${-o.width/2} ${-o.width}A${o.width} ${o.width} 0 0 1 ${o.width/2} 0" fill="none" stroke="${c}" stroke-width="${px}"/>`;s+='</g>';}
 for(const st of f.stairs.filter(o=>!o.hidden)){s+=`<g class="entity" data-kind="stair" data-id="${st.id}" transform="translate(${st.x},${st.y}) rotate(${st.rot})"><rect x="${-st.w/2}" y="${-st.d/2}" width="${st.w}" height="${st.d}" fill="#dbd3ba" stroke="${chosen.has(st.id)?'#d98259':'#a59b7c'}" stroke-width="${px*1.5}"/>`;const n=Math.ceil(f.height/.18);for(let i=1;i<n;i++)s+=`<path d="M${-st.w/2} ${-st.d/2+i*st.d/n}h${st.w}" stroke="#a59b7c" stroke-width="${.8*px}"/>`;s+=`<path d="M0 ${st.d*.32}V${-st.d*.32}l-.14 .25m.14-.25 .14 .25" fill="none" stroke="#8a8f96" stroke-width="${1.4*px}"/></g>`;}
 if(ui.furniture)for(const item of f.furniture.filter(o=>!o.hidden)){s+=`<g class="entity furniture-entity" data-kind="furniture" data-id="${item.id}" transform="translate(${item.x},${item.y}) rotate(${item.rot})"><rect class="furniture-hit" x="${-item.w/2}" y="${-item.d/2}" width="${item.w}" height="${item.d}" fill="transparent" pointer-events="fill"/><g transform="scale(${item.mirrorX?-.001:.001},.001)" pointer-events="none">${furnSVG(item.type,item.w*1000,item.d*1000,item.color||'#c9bea6')}</g></g>`;}
 if(editable&&ui.furniture&&sel?.kind==='furniture'&&ui.tool==='select'){
  const item=selected();if(item){
   const handles=[['nw',-1,-1,'左上角'],['n',0,-1,'上边'],['ne',1,-1,'右上角'],['e',1,0,'右边'],['se',1,1,'右下角'],['s',0,1,'下边'],['sw',-1,1,'左下角'],['w',-1,0,'左边']];
   s+=`<g class="furniture-frame" transform="translate(${item.x},${item.y}) rotate(${item.rot})"><rect x="${-item.w/2}" y="${-item.d/2}" width="${item.w}" height="${item.d}" fill="none" stroke="#d98259" stroke-width="${2*px}" pointer-events="none"/>`+handles.map(([handle,x,y,label])=>{
    const angle=(Math.atan2(y,x)*180/Math.PI+item.rot+720)%180,cursor=['ew-resize','nwse-resize','ns-resize','nesw-resize'][Math.round(angle/45)%4];
    return`<g class="furniture-resize" data-kind="furniture-resize" data-handle="${handle}" data-id="${item.id}" transform="translate(${x*item.w/2},${y*item.d/2})" style="cursor:${cursor}"><title>${label}：${x&&y?'拖动等比缩放':'拖动调整宽度或进深'}</title><circle r="${11*px}" fill="transparent" pointer-events="fill"/><rect x="${-4.5*px}" y="${-4.5*px}" width="${9*px}" height="${9*px}" rx="${1.5*px}" fill="white" stroke="#d98259" stroke-width="${1.8*px}" pointer-events="none"/></g>`;
   }).join('')+'</g>';
   const a=item.rot*Math.PI/180,top=Math.abs(Math.sin(a))*item.w/2+Math.abs(Math.cos(a))*item.d/2;
   s+=svgText(item.x,item.y-top-16*px,`${item.w.toFixed(2)} × ${item.d.toFixed(2)} m`,12*px,'fill="#c77b57" pointer-events="none"');
  }
 }
 if(editable&&sel?.kind==='opening'&&ui.tool==='select'){const o=selected(),w=f.walls.find(w=>w.id===o.wallId);for(const end of ['start','end']){const p=M.onWall(w,o.offset+(end==='start'?-1:1)*o.width/2);s+=`<g data-kind="opening-resize" data-id="${o.id}" data-end="${end}" class="opening-resize" style="cursor:ew-resize"><title>拖动调整门窗宽度</title><circle cx="${p.x}" cy="${p.y}" r="${11*px}" fill="transparent" pointer-events="fill"/><rect x="${p.x-4.5*px}" y="${p.y-4.5*px}" width="${9*px}" height="${9*px}" rx="${px}" fill="white" stroke="#d98259" stroke-width="${1.8*px}" pointer-events="none"/></g>`;}}
 if(editable&&sel?.kind==='wall'){const w=selected();if(w)for(const end of['a','b'])s+=`<circle class="entity" data-kind="handle" data-end="${end}" data-id="${w.id}" cx="${w[end].x}" cy="${w[end].y}" r="${5*px}" fill="#fff" stroke="#d98259" stroke-width="${2*px}"/>`;}
 if(f.image?.crop){const c=f.image.crop;s+=`<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" fill="none" stroke="#998547" stroke-dasharray="${5*px} ${4*px}" stroke-width="${1.3*px}" pointer-events="none"/>`;}
 if(ui.start&&ui.pointer){const a=ui.start,b=ui.pointer;if(ui.tool==='room'||ui.tool==='crop')s+=`<rect x="${Math.min(a.x,b.x)}" y="${Math.min(a.y,b.y)}" width="${Math.abs(a.x-b.x)}" height="${Math.abs(a.y-b.y)}" fill="#4f6d8618" stroke="#4f6d86" stroke-width="${2*px}" stroke-dasharray="${5*px} ${3*px}"/>`;else{s+=`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#4f6d86" stroke-width="${ui.tool==='wall'?.2:2*px}"/>`;s+=svgText((a.x+b.x)/2,(a.y+b.y)/2-.25,(ui.tool==='calibrate'?'点击另一端':M.dist(a,b).toFixed(2)+' m'),12*px,'fill="#4f6d86"');}}
 if(ui.measure){const {a,b}=ui.measure;s+=`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#bd8f3f" stroke-width="${2*px}"/>`+svgText((a.x+b.x)/2,(a.y+b.y)/2-.25,M.dist(a,b).toFixed(3)+' m',12*px,'fill="#9c7430"');}
 if(ui.tool==='calibrate'&&ui.start){const p=ui.start;s+='<circle cx="'+p.x+'" cy="'+p.y+'" r="'+8*px+'" fill="#4f6d86"/>'+svgText(p.x,p.y+4*px,'1',11*px,'fill="white" pointer-events="none"');}
 if(editable&&sel?.kind==='room'&&selected()?.manual&&ui.tool==='select')selected().poly.forEach(([x,y],index)=>{
  s+=`<g data-kind="room-vertex" data-id="${sel.id}" data-index="${index}" class="room-vertex"><circle cx="${x}" cy="${y}" r="${10*px}" fill="transparent" pointer-events="fill"/><rect x="${x-4*px}" y="${y-4*px}" width="${8*px}" height="${8*px}" fill="white" stroke="#d98259" stroke-width="${1.6*px}" pointer-events="none"/></g>`;
 });
 if(editable&&sel?.kind==='solid'&&ui.tool==='select')selected().poly.forEach(([x,y],index)=>{s+=`<g data-kind="solid-vertex" data-id="${sel.id}" data-index="${index}" class="room-vertex"><circle cx="${x}" cy="${y}" r="${10*px}" fill="transparent" pointer-events="fill"/><rect x="${x-4*px}" y="${y-4*px}" width="${8*px}" height="${8*px}" fill="white" stroke="#d98259" stroke-width="${1.6*px}" pointer-events="none"/></g>`;});
 if(ui.tool==='repair'){
  if(ui.repairMode==='floor'){
   const pts=ui.repairPoints,preview=ui.pointer&&pts.length?[...pts,ui.pointer]:pts;
   if(preview.length>1)s+=`<polyline points="${preview.map(p=>`${p.x},${p.y}`).join(' ')}" fill="${preview.length>2?'#d9825920':'none'}" stroke="#d98259" stroke-width="${2*px}" stroke-dasharray="${6*px} ${3*px}" pointer-events="none"/>`;
   pts.forEach((p,i)=>{s+=`<circle cx="${p.x}" cy="${p.y}" r="${(i?4:7)*px}" fill="#d98259" stroke="white" stroke-width="${px}" pointer-events="none"/>`+svgText(p.x,p.y-11*px,i===0?'起点':String(i+1),11*px,'fill="#b36844" pointer-events="none"');});
  }else if(ui.repairMode==='connect'){
   for(const w of f.walls.filter(w=>w.structuralKind!=='column'&&!w.hidden&&!w.locked))for(const end of ['a','b']){const p=w[end],chosen=ui.repairEnds.some(q=>q.id===w.id&&q.end===end);s+=`<g data-kind="repair-end" data-id="${w.id}" data-end="${end}" class="repair-end"><circle cx="${p.x}" cy="${p.y}" r="${11*px}" fill="transparent" pointer-events="fill"/><circle cx="${p.x}" cy="${p.y}" r="${(chosen?6:4)*px}" fill="${chosen?'#d98259':'white'}" stroke="${chosen?'#b36844':'#4f6d86'}" stroke-width="${1.5*px}" pointer-events="none"/></g>`;}
   if(ui.repairEnds.length===2){const [a,b]=ui.repairEnds.map(q=>f.walls.find(w=>w.id===q.id)?.[q.end]);if(a&&b)s+=`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#d98259" stroke-width="${2*px}" stroke-dasharray="${6*px} ${4*px}" pointer-events="none"/>`;}
  }
 }
 s+=renderEditOverlays(f,refs,px);s+=modeling?.planOverlay(px)||'';
 const snap=ui.snap?ui.snapFeedback:null;
 if(snap){
  s+='<g class="snap-guides" pointer-events="none">';
  for(const g of snap.guides||[])s+=`<line x1="${g.axis==='x'?g.value:g.from}" y1="${g.axis==='x'?g.from:g.value}" x2="${g.axis==='x'?g.value:g.to}" y2="${g.axis==='x'?g.to:g.value}" stroke="#4f6d86" stroke-width="${1.7*px}" stroke-dasharray="${6*px} ${4*px}"/>`;
  if(snap.point)s+=`<circle cx="${snap.point.x}" cy="${snap.point.y}" r="${6*px}" fill="#ffffffbb" stroke="#4f6d86" stroke-width="${2*px}"/>`;
  s+='</g>';
 }
 $('#snapStatus').hidden=!snap?.label;$('#snapStatus').textContent=snap?.label?'吸附：'+snap.label:'';
 renderCalibrationGuide();svg.innerHTML=s;$('#emptyHint').hidden=f.walls.length>0||!!f.solids?.length||!!f.image||!!f.cad||!!ui.start||ui.tool==='solid';
 furnitureToolbar.sync();
}
const field=(label,key,value,{min,max,step=.1,type='number',title=''}={})=>`<label class="field" ${title?`title="${esc(title)}"`:''}><span>${label}</span><input data-prop="${key}" aria-label="${label}" type="${type}" value="${esc(typeof value==='number'?Math.round(value*1000)/1000:value)}" ${min!==undefined?`min="${min}"`:''} ${max!==undefined?`max="${max}"`:''} ${type==='number'?`step="${step}"`:''}></label>`;
function renderInspector(){
 const f=floor(),o=selected();let html='';
 if(ui.panel==='objects'&&ui.tool==='select')html=objectList(f,selectionRefs(),ui.objectFilter);
 else if(ui.tool==='guide')html=guidePanel(f,ui.guideAxis);
 else if(selectionRefs().length>1&&!ui.library)html='';
 else if(ui.library){html=`<section class="section"><h2 class="section-title">家具库 <small>沿用原 /floor 模型</small></h2><label class="field"><select id="furnCategory" aria-label="家具分类">${LIB.map((c,i)=>`<option value="${i}" ${i===ui.category?'selected':''}>${esc(c.cat)}</option>`).join('')}</select></label><div class="library-list">${LIB[ui.category].items.map((v,i)=>`<button class="library-item" data-item="${i}"><svg viewBox="${-v[2]/2-100} ${-v[3]/2-100} ${v[2]+200} ${v[3]+200}">${furnSVG(v[0],v[2],v[3],v[4])}</svg><span>${esc(v[1])}</span><small>${v[2]/1000} × ${v[3]/1000} m</small></button>`).join('')}</div><p class="muted">点选家具，再点击平面放置。选中后可移动、旋转和改尺寸。</p></section>`;}
 else if(o){const name={wall:'墙体',opening:o.type==='door'?'门':'窗',room:o.name||'分区',furniture:o.name||'家具',stair:'直跑楼梯',solid:o.name||'自建构件'}[ui.sel.kind];html=`<section class="section"><h2 class="section-title">${esc(name)}<span class="selection-tag">已选中</span></h2>`;
  if(ui.sel.kind==='wall'){const a=Math.atan2(o.b.y-o.a.y,o.b.x-o.a.x)*180/Math.PI;html+=`<div class="field-row">${field('长度 / m','length',M.length(o),{min:.2,max:100})}${field('厚度 / m','thickness',o.thickness,{min:.05,max:1,step:.01})}</div><div class="field-row">${field('墙高 / m','height',o.height||f.height,{min:.2,max:8})}${field('角度 / °','angle',a,{min:-360,max:360,step:1})}</div><div class="field-row">${field('起点 X / m','ax',o.a.x)}${field('起点 Y / m','ay',o.a.y)}</div>${field('墙面颜色','color',o.color||'#edece5',{type:'color'})}<p class="muted">拖动墙体可平移，拖动两个端点可调整位置。门窗随所属墙移动。</p>`;}
  if(ui.sel.kind==='solid'){html+=field('构件名称','name',o.name,{type:'text'})+`<div class="field-row">${field('高度 / m','height',o.height,{min:.02,max:8,step:.05})}${field('离地 / m','base',o.base,{min:0,max:16,step:.05})}</div>`+field('构件颜色','color',o.color,{type:'color'})+`<p class="muted">占地 ${solidArea(o).toFixed(2)} m² · 体积 ${(solidArea(o)*o.height).toFixed(2)} m³</p><button class="btn small" id="editSolidHeight" title="打开推拉工具，在三维中拖动顶面或侧面。">三维推拉</button>`;}
  if(ui.sel.kind==='opening'){const parentWall=f.walls.find(w=>w.id===o.wallId),wallHeight=parentWall.height||f.height;html+=`<div class="field-row">${field('宽度 / m','width',o.width,{min:.2,max:M.length(parentWall),step:.05,title:'可输入尺寸，或拖动平面图上洞口两端的橙色手柄。'})}${field('高度 / m','height',o.height,{min:.2,max:wallHeight-(o.sill||0),step:.05})}</div>${field('距墙起点 / m','offset',o.offset,{min:0,max:100})}`;if(o.type==='door')html+=`<div class="property-group"><h3>开门方向</h3><div class="action-row"><button class="btn small" data-door-flip="hinge" title="交换门扇的铰链位置，保留开启的墙侧。">左右翻转</button><button class="btn small" data-door-flip="swing" title="切换门扇向墙的另一侧开启。">内外翻转</button></div></div>`;if(o.type==='window')html+=field('窗台高度 / m','sill',o.sill,{min:0,max:6});html+=`<label class="field"><span>构件类型</span><select data-prop="type" aria-label="构件类型"><option value="door" ${o.type==='door'?'selected':''}>门</option><option value="window" ${o.type==='window'?'selected':''}>窗</option></select></label><p class="muted">${o.inferred?'这是根据墙线间隙推测的洞口，请对照原图确认类型和尺寸。':'门窗为真实洞口，尺寸变化会同步更新墙体。'}</p>`;}
  if(['furniture','stair'].includes(ui.sel.kind)){
   const isFurniture=ui.sel.kind==='furniture',limits=isFurniture?{min:.01,max:40}:{min:.2,max:20};
   html+=`<div class="property-group"><h3>位置</h3><div class="field-row">${field('X / m','x',o.x,{title:'家具中心在平面图中的横向坐标；修改后整体左右移动，尺寸不变。'})}${field('Y / m','y',o.y,{title:'家具中心在平面图中的纵向坐标；修改后整体前后移动，尺寸不变。'})}</div>`;
   if(isFurniture)html+=field('Z 离地高度 / m','z',o.z??furnitureMetrics(o).base,{min:-16,max:16,step:.05,title:'家具底部相对当前楼层地面的高度。0 表示落地，正数向上移动；负数低于地面。'});
   html+=`</div><div class="property-group"><h3>尺寸</h3><div class="field-row">${field('宽度 / m','w',o.w,{...limits,title:'家具本身从左到右的尺寸；旋转家具后，宽度方向随家具一起转动。'})}${field('进深 / m','d',o.d,{...limits,title:'家具本身从前到后的尺寸；修改后改变占地深度，不是移动位置。'})}</div></div>${field('旋转 / °','rot',o.rot,{min:-360,max:360,step:15})}`;
   if(isFurniture)html+=`<div class="action-row furniture-scale-actions" title="在平面图中拖家具移动；拖四角等比缩放，拖边中点单独改宽度或进深。"><button class="btn small" data-furniture-scale=".9">缩小 10%</button><button class="btn small" data-furniture-scale="1.1">放大 10%</button></div>`+field('颜色','color',o.color||'#c9bea6',{type:'color'});
   else html+='<p class="muted">楼梯连接当前层与上一层。上一层楼板会在楼梯完全落入房间轮廓时自动留洞。</p>';
  }
  if(ui.sel.kind==='room'){html+=(o.manual?'<p class="muted">手动分区：拖动橙色角点调整边界；调整后可撤销。</p><div class="action-row"><button class="btn small danger" id="deleteRoomContour">删除分区</button></div>':'<button class="btn small" id="editRoomContour">手动调整轮廓</button>')+field('房间名称','name',o.name,{type:'text'})+`<p class="muted">${o.manual?'手动分区面积':'墙中线围合面积'} ${M.area(o.poly).toFixed(2)} m²</p><div class="material-list">${Object.entries(MATS).map(([k,m])=>`<button class="material ${o.mat===k?'active':''}" data-mat="${k}"><i style="background:${m.sw}"></i><span>${esc(m.name.replace(/\d+ /,''))}</span></button>`).join('')}</div>`;}
  html+=`<div class="action-row">${['furniture','stair','solid'].includes(ui.sel.kind)?'<button class="btn small" id="duplicateSelection">复制</button>':''}${ui.sel.kind!=='room'?`<button class="btn small danger" id="deleteSelection">${ico('trash')}删除</button>`:''}<button class="btn small" id="deselect">取消选择</button></div></section>`;
 }
 else{html+=`<section class="section"><h2 class="section-title">建筑概览 <small>可编辑白模</small></h2><div class="stat-grid"><div><b>${project.floors.length}</b><span>楼层</span></div><div><b>${project.floors.reduce((n,f)=>n+f.rooms.length,0)}</b><span>房间</span></div><div><b>${project.floors.reduce((n,f)=>n+f.walls.length,0)}</b><span>墙段</span></div></div></section>`;}
 if(!ui.library&&ui.tool!=='guide'&&ui.panel!=='objects'){html+=`<section class="section floor-management"><h2 class="section-title">楼层管理 <small>共 ${project.floors.length} 层</small></h2><div class="floor-list">${project.floors.map((fl,i)=>`<button class="floor-card ${fl.id===ui.floor?'active':''}" data-floor="${fl.id}" aria-pressed="${fl.id===ui.floor}"><span class="floor-symbol" aria-hidden="true">${ico('layers')}</span><span class="floor-info"><span class="floor-card-heading"><b title="${esc(fl.name)}">${esc(fl.name)}</b>${fl.id===ui.floor?'<span class="floor-editing">正在编辑</span>':''}</span><small title="最下层楼面为 0 m，其余楼层按下方各层层高累加。">楼面高度 ${M.floorElevation(project,i).toFixed(2)} m</small><small class="floor-content">${floorContentLabel(fl)}</small></span></button>`).join('')}</div><div class="field-row">${field('楼层名称','floorName',f.name,{type:'text',title:'自定义显示名称，可直接修改；名称不决定楼层顺序或高度。'})}${field('层高 / m','floorHeight',f.height,{min:2,max:8,title:'本层楼面到上一层楼面的高度。'})}</div><div class="action-row"><button class="btn small" id="duplicateFloor">${ico('copy')}复制本层</button><button class="btn small danger" id="deleteFloor" title="${project.floors.length===1?'保留这一个楼层，清空其中的内容；可以撤销。':'删除本层及其内容；可以撤销。'}">${project.floors.length===1?'清空本层内容':'删除本层'}</button></div></section>`;
 if(f.cad)html+=`<section class="section"><h2 class="section-title">CAD 参考线 <small>按真实尺寸</small></h2><p class="muted">${esc(f.cad.name)}</p><label class="toggle-row">显示 CAD 参考线<input type="checkbox" id="toggleCAD" ${!f.cad.hidden?'checked':''}></label><button class="btn small" id="removeCADReference" title="仅移除 CAD 参考线，生成的墙体和门窗保留，可撤销。">移除参考线</button></section>`;
 html+=`<section class="section"><h2 class="section-title">图纸底图 <small>${f.image?'已导入':'当前层'}</small></h2>`;
 if(f.image){html+=`<p class="muted" style="overflow-wrap:anywhere">${esc(f.image.name)}</p>${!f.image.calibrated?'<div class="scale-note"><b>不知道尺寸也可以先建模</b><span>先预览结构，长度和面积暂按估算值显示。</span></div>':''}<button class="btn full primary" id="recognize">${ico('scan')}${f.image.calibrated?'辅助识别建模':'先识别建模'}</button><button class="btn small calibrate-optional" id="calibrate">${ico('measure')}${f.image.calibrated?'重新校准尺寸':'校准尺寸（可选）'}</button><label class="field"><span>底图透明度</span><input type="range" id="imageOpacity" min=".05" max="1" step=".05" value="${f.image.opacity}" aria-label="底图透明度"></label><div class="field-row">${field('底图 X / m','imageX',f.image.x)}${field('底图 Y / m','imageY',f.image.y)}</div><div class="action-row"><button class="btn small" id="cropImage">设置识别范围</button><button class="btn small danger" id="removeImage">移除</button></div><p class="muted">${f.image.calibrated?'尺寸已校准':'尺寸待校准；知道真实长度时，可用“校准尺寸”修正。'}</p>`;}
 else html+=`<button class="btn full" id="importPlanSide">${ico('upload')}导入图片 / PDF / CAD</button><p class="muted">图纸仅在本机浏览器中处理。导入后可校准尺寸、辅助识别或沿底图画墙。</p>`;html+='</section>';
 html+=`<section class="section"><h2 class="section-title">显示设置</h2><label class="field"><span>屋顶（按顶层外包矩形生成）</span><select id="roof" aria-label="屋顶"><option value="none" ${project.roof==='none'?'selected':''}>无屋顶</option><option value="flat" ${project.roof==='flat'?'selected':''}>平屋顶</option><option value="gable" ${project.roof==='gable'?'selected':''}>双坡屋顶</option><option value="hip" ${project.roof==='hip'?'selected':''}>四坡屋顶</option></select></label><label class="toggle-row">显示底图<input type="checkbox" id="toggleBlueprint" ${ui.blueprint?'checked':''}></label><button class="btn small full" id="findRooms">重新计算房间轮廓</button><p class="muted">闭合墙线可自动围合房间。面积按墙中线计算。</p></section>`;
 }
 const refs=selectionRefs();
 if(!ui.library&&!['repair','guide'].includes(ui.tool)&&ui.panel!=='objects')html=selectionTools(f,refs)+html;
 if(ui.tool==='box')html='<section class="section"><h2 class="section-title">框选构件</h2><p class="muted">拖出选框，选择完全在框内的构件。按住 Shift 可追加。选中后可直接拖动或成组。</p><label class="field"><span>框选范围</span><select id="boxFilter" aria-label="框选范围">'+[['furniture','家具'],['wall','墙体'],['opening','门窗'],['room','地面分区'],['stair','楼梯'],['solid','自建构件'],['all','全部构件']].map(([v,n])=>'<option value="'+v+'" '+(ui.boxFilter===v?'selected':'')+'>'+n+'</option>').join('')+'</select></label></section>'+html;
 $('#inspector').innerHTML='<div class="inspector-tabs"><button data-panel="properties" class="'+(ui.panel==='properties'?'active':'')+'">属性与编辑</button><button data-panel="objects" class="'+(ui.panel==='objects'?'active':'')+'">构件列表</button></div>'+html;
 if(refs.length===1&&E.locked(f,refs[0]))$('#inspector').querySelectorAll('[data-prop]:not([data-prop^=floor]),[data-mat],#deleteSelection,#duplicateSelection,#editRoomContour,#deleteRoomContour,[data-furniture-scale],[data-door-flip]').forEach(el=>el.disabled=true);
 if(f.image?.locked)$('#inspector').querySelectorAll('[data-prop^=image],#removeImage,#calibrate').forEach(el=>el.disabled=true);

}

function pointFrom(e,doSnap=false){
 const svg=$('#plan'),pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const p=pt.matrixTransform(svg.getScreenCTM().inverse());let q={x:p.x,y:p.y};
 if(doSnap&&ui.snap){
  const threshold=M.clamp(view.w/Math.max(1,svg.clientWidth)*11,.025,.25),snap=M.snapPlanPoint(q,floor(),threshold,{ignoreWallId:['wall','handle'].includes(drag?.kind)?ui.sel?.id:undefined});q=snap.point;const guide=E.snapGuidePoint({x:p.x,y:p.y},floor().guides,threshold);if(guide.guides.length){for(const g of guide.guides)q[g.axis]=guide.point[g.axis];snap.point=q;snap.guides=guide.guides;snap.label='参考线吸附';}
  if(!['select','pan','crop'].includes(ui.tool)||['wall','handle'].includes(drag?.kind))ui.snapFeedback=snap;
 }
 if(doSnap&&e.shiftKey&&ui.start){if(Math.abs(q.x-ui.start.x)>Math.abs(q.y-ui.start.y))q.y=ui.start.y;else q.x=ui.start.x;if(ui.snapFeedback?.point&&M.dist(q,ui.snapFeedback.point)>.001)ui.snapFeedback=null;}
 return q;
}
function renderEditOverlays(f,refs,px){
 let s='';
 for(const g of f.guides||[]){if(g.hidden)continue;const x1=g.axis==='x'?g.value:view.x,x2=g.axis==='x'?g.value:view.x+view.w,y1=g.axis==='y'?g.value:view.y,y2=g.axis==='y'?g.value:view.y+view.h;
  s+=`<g class="reference-guide" data-kind="guide" data-id="${g.id}" ${ui.tool==='guide'&&!g.locked?'':'pointer-events="none"'}><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="transparent" stroke-width="${10*px}"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#72939e" stroke-width="${px}" stroke-dasharray="${7*px} ${5*px}"/>${svgText(g.axis==='x'?g.value:view.x+60*px,g.axis==='y'?g.value-5*px:view.y+80*px,`${g.axis.toUpperCase()} ${Math.round(g.value*1000)} mm${g.locked?' · 锁定':''}`,10*px,'fill="#4f6d86" pointer-events="none"')}</g>`;
 }
 if(refs.length>1){const b=E.selectionBounds(f,refs);if(b)s+=`<rect class="multi-selection-frame" x="${b.x0-4*px}" y="${b.y0-4*px}" width="${b.w+8*px}" height="${b.d+8*px}" fill="none" stroke="#d98259" stroke-width="${1.6*px}" stroke-dasharray="${6*px} ${3*px}" pointer-events="none"/>`;}
 for(const ref of refs.filter(r=>r.kind==='furniture'&&!E.hidden(f,r))){if(refs.length===1&&!E.locked(f,ref))continue;const o=E.entity(f,ref);s+=`<rect transform="translate(${o.x},${o.y}) rotate(${o.rot})" x="${-o.w/2}" y="${-o.d/2}" width="${o.w}" height="${o.d}" fill="none" stroke="#d98259" stroke-width="${2*px}" pointer-events="none"/>`;}
 if(drag?.kind==='box'){const a=drag.start,b=drag.current||a;s+=`<rect class="selection-marquee" x="${Math.min(a.x,b.x)}" y="${Math.min(a.y,b.y)}" width="${Math.abs(a.x-b.x)}" height="${Math.abs(a.y-b.y)}" fill="#4f6d8618" stroke="#4f6d86" stroke-width="${1.5*px}" stroke-dasharray="${5*px} ${3*px}" pointer-events="none"/>`;}
 return s;
}
function addGuide(axis,value){if(!Number.isFinite(value)||Math.abs(value)>500)throw new Error('参考线位置应在 ±500000 毫米以内');const f=floor();if((f.guides||[]).some(g=>g.axis===axis&&Math.abs(g.value-value)<.001))throw new Error('此位置已有参考线');if((f.guides||[]).length>=500)throw new Error('本层最多 500 条参考线');(f.guides??=[]).push({id:M.uid(),axis,value});}
function runEdit(action){
 const refs=selectionRefs(),f=floor(),number=id=>{const el=$('#'+id);if(!el||el.value.trim()===''||!Number.isFinite(Number(el.value)))throw new Error('请填写有效数值');return Number(el.value);};
 const apply=opts=>{if(mutate(()=>setSelection(E.transformSelection(floor(),refs,opts)),{rooms:refs.some(r=>r.kind==='wall')}))toast(opts.copy?'复制完成，可撤销':'调整完成，可撤销');};
 try{
  if(action==='group'){mutate(()=>setSelection(E.groupSelection(f,refs)));return;}
  if(action==='ungroup'){mutate(()=>E.ungroupSelection(f,refs));return;}
  if(action==='move')return apply({dx:number('moveX')/1000,dy:number('moveY')/1000});
  if(action==='rotate')return apply({angle:number('rotateBy')});
  if(action==='mirrorX'||action==='mirrorY')return apply({mirror:action==='mirrorX'?'x':'y',copy:$('#mirrorCopy').checked});
  if(action==='copy'){if(refs.length&&refs.every(r=>r.kind==='opening')){const ops=refs.map(r=>E.entity(f,r)),w=f.walls.find(w=>w.id===ops[0].wallId),step=Math.max(...ops.map(o=>o.offset+o.width/2))-Math.min(...ops.map(o=>o.offset-o.width/2))+.2;return apply({dx:(w.b.x-w.a.x)/M.length(w)*step,dy:(w.b.y-w.a.y)/M.length(w)*step,copy:true});}return apply({dx:.5,dy:.5,copy:true});}
  if(action==='array'){const dx=number('copyX')/1000,dy=number('copyY')/1000;if(Math.hypot(dx,dy)<.001)throw new Error('请设置非零复制间距');return apply({dx,dy,copy:true,count:number('copyCount')});}
  if(action==='clearance')return apply(E.wallClearance(f,refs,$('#wallSide').value,number('wallGap')/1000));
  if(action==='delete'){if(!refs.length)return;mutate(()=>{E.removeSelection(f,refs);setSelection([]);},{rooms:refs.some(r=>r.kind==='wall')});return;}
  if(action==='clear'){setSelection([]);render();return;}
  if(action==='hide'||action==='lock'){mutate(()=>{const key=action==='hide'?'hidden':'locked',value=action==='hide'||!refs.some(r=>E.locked(f,r));if(!value)refs.filter(r=>r.kind==='opening').forEach(r=>{const o=E.entity(f,r),w=f.walls.find(w=>w.id===o.wallId);if(w?.locked)E.setFlag(f,[{kind:'wall',id:w.id}],'locked',false);});E.setFlag(f,refs,key,value);if(action==='hide')setSelection([]);});return;}
  if(action==='selectFiltered'){setSelection(E.expandSelection(f,E.entities(f).filter(r=>(ui.objectFilter==='all'||r.kind===ui.objectFilter)&&!E.hidden(f,r)&&!E.locked(f,r))));render();return;}
  if(action==='editSelected'){ui.panel='properties';renderInspector();return;}
  if(action==='showAllObjects'||action==='unlockAll'){mutate(()=>{const key=action==='showAllObjects'?'hidden':'locked';E.entities(f).forEach(r=>r.o[key]=false);if(f.image)f.image[key]=false;});return;}
  if(action==='addGuide'){const value=number('guidePosition')/1000;mutate(()=>addGuide(ui.guideAxis,value));return;}
  if(action==='exitGuide')setTool('select');
 }catch(e){toast(e.message);}
}
$('#inspector').addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.panel){ui.panel=b.dataset.panel;setTool('select');renderInspector();return;}
 if(b.dataset.edit){runEdit(b.dataset.edit);return;}
 if(b.dataset.selectId){choose({id:b.dataset.selectId,kind:b.dataset.selectKind},e.shiftKey);render();return;}
 if(b.dataset.flag){const ref={id:b.dataset.refId,kind:b.dataset.refKind},key=b.dataset.flag,value=key==='locked'?!E.locked(floor(),ref):!E.hidden(floor(),ref);mutate(()=>{const o=E.entity(floor(),ref),parent=ref.kind==='opening'&&floor().walls.find(w=>w.id===o.wallId);if(!value&&parent?.[key])E.setFlag(floor(),[{kind:'wall',id:parent.id}],key,false);E.setFlag(floor(),[ref],key,value);});return;}
 if(b.dataset.imageState){mutate(()=>{const i=floor().image,k=b.dataset.imageState;i[k]=!i[k];});return;}
 if(b.dataset.guideDelete||b.dataset.guideLock){mutate(()=>{const id=b.dataset.guideDelete||b.dataset.guideLock,g=floor().guides.find(g=>g.id===id);if(b.dataset.guideLock)g.locked=!g.locked;else if(!g.locked)floor().guides=floor().guides.filter(g=>g.id!==id);});}
});
$('#inspector').addEventListener('change',e=>{
 const el=e.target;if(el.id==='objectFilter'){ui.objectFilter=el.value;renderInspector();}else if(el.id==='boxFilter')ui.boxFilter=el.value;else if(el.id==='guideAxis')ui.guideAxis=el.value;
 else if(el.dataset.guideValue){const value=Number(el.value)/1000;mutate(()=>{if(el.value.trim()===''||!Number.isFinite(value)||Math.abs(value)>500)throw new Error('请输入有效参考线位置');const g=floor().guides.find(g=>g.id===el.dataset.guideValue);if(!g.locked)g.value=value;});}
});
$('#plan').addEventListener('wheel',e=>{e.preventDefault();const p=pointFrom(e),k=e.deltaY>0?1.12:1/1.12,nw=M.clamp(view.w*k,2,250),ratio=nw/view.w;view.x=p.x+(view.x-p.x)*ratio;view.y=p.y+(view.y-p.y)*ratio;view.h*=ratio;view.w=nw;renderPlan();},{passive:false});
$('#plan').addEventListener('pointerdown',e=>{
 if(e.button===2)return;e.preventDefault();ui.snapFeedback=null;const p=pointFrom(e,ui.tool!=='calibrate'),raw=pointFrom(e),svg=$('#plan');svg.setPointerCapture(e.pointerId);
 if(ui.tool==='pan'||e.button===1||e.altKey){drag={kind:'pan',x:e.clientX,y:e.clientY,startView:{...view}};return;}
 if(ui.tool==='guide'){
  const el=e.target.closest('[data-kind="guide"]'),g=el&&floor().guides?.find(g=>g.id===el.dataset.id);
  if(g&&!g.locked){drag={kind:'guide',id:g.id,original:M.clone(g),rawStart:raw,clientStart:{x:e.clientX,y:e.clientY}};draftBefore=M.clone(project);}else mutate(()=>addGuide(ui.guideAxis,p[ui.guideAxis]));return;
 }
 if(ui.tool==='box'){drag={kind:'box',start:raw,current:raw,add:e.shiftKey,existing:selectionRefs()};renderPlan();return;}
 if(modeling?.pointerDown(e,p))return;
 if(ui.tool==='repair'){repairPointer(e,p);return;}
 if(['wall','room','measure','calibrate','crop'].includes(ui.tool)){
  if(!ui.start){ui.start=p;ui.pointer=p;renderPlan();return;}const a={...ui.start},b=p;if(M.dist(a,b)<.08)return;
  if(ui.tool==='wall'){mutate(()=>{floor().walls.push(M.wall(a,b));},{rooms:true});ui.start=b;ui.pointer=b;}
  else if(ui.tool==='room'){if(Math.abs(a.x-b.x)<.3||Math.abs(a.y-b.y)<.3)return;mutate(()=>{const pts=[a,{x:b.x,y:a.y},b,{x:a.x,y:b.y}];for(let i=0;i<4;i++)floor().walls.push(M.wall(pts[i],pts[(i+1)%4]));},{rooms:true});ui.start=null;}
  else if(ui.tool==='measure'){ui.measure={a,b};ui.start=null;toast(`距离 ${M.dist(a,b).toFixed(3)} m`);}
  else if(ui.tool==='calibrate'){ui.start=null;calibrationDialog(a,b);}
  else{mutate(()=>{floor().image.crop={x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(a.x-b.x),h:Math.abs(a.y-b.y)};});setTool('select');toast('已设置识别范围');}
  renderPlan();return;
 }
 if(ui.tool==='door'||ui.tool==='window'){const hit=M.nearestWall(raw,{...floor(),walls:floor().walls.filter(w=>!w.hidden&&!w.locked)},.8);if(!hit){toast('请点击要放置门窗的墙体');return;}const type=ui.tool,width=Math.min(type==='door'?.9:1.5,M.length(hit.wall)),o={id:M.uid(),wallId:hit.wall.id,type,width,offset:M.clamp(hit.offset,width/2,M.length(hit.wall)-width/2),height:type==='door'?2.1:1.4,sill:type==='door'?0:.9,hinge:1};if(!M.canPlaceOpening(floor(),o)){toast('此处放不下门窗，请避开已有洞口');return;}mutate(()=>{floor().openings.push(o);setSelection([{kind:'opening',id:o.id,floorId:ui.floor}]);});setTool('select');return;}
 if(ui.tool==='stairs'){const o={id:M.uid(),x:p.x,y:p.y,w:1.1,d:3.8,rot:0};mutate(()=>{floor().stairs.push(o);ui.sel={kind:'stair',id:o.id,floorId:ui.floor};});setTool('select');return;}
 if(ui.tool==='furniture'&&ui.furnitureItem){const v=ui.furnitureItem,o={id:M.uid(),type:v[0],name:v[1],w:v[2]/1000,d:v[3]/1000,color:v[4],x:p.x,y:p.y,rot:0};mutate(()=>{floor().furniture.push(o);ui.sel={kind:'furniture',id:o.id,floorId:ui.floor};});setTool('select');ui.library=false;renderInspector();return;}
 const ent=e.target.closest('[data-kind]');
 if(!ent&&ui.tool==='select'){const rooms=M.missingRooms(floor()),room=rooms.find(r=>M.pointIn(raw,r.poly));if(room){mutate(()=>{floor().rooms.push(...rooms);setSelection([{kind:'room',id:room.id,floorId:ui.floor}]);});toast('已补全地面分区，可修改名称和材质');return;}}
 if(ent){
  const kind=ent.dataset.kind,id=ent.dataset.id,ref={kind:kind==='handle'?'wall':kind==='room-vertex'?'room':kind==='solid-vertex'?'solid':kind==='furniture-resize'?'furniture':kind==='opening-resize'?'opening':kind,id,floorId:ui.floor};
  if(!E.entity(floor(),ref))return;
  if(E.locked(floor(),ref)){toast('此构件已锁定，可在构件列表解锁');return;}
  if(e.shiftKey){choose(ref,true);renderPlan();renderInspector();syncChrome();viewer?.markSelection(selectionRefs());return;}
  if(!selectionRefs().some(r=>r.id===id))choose(ref);
  ui.library=false;const refs=selectionRefs(),o=E.entity(floor(),ref);
  if(refs.length>1){drag={kind:'batch',refs:M.clone(refs),start:p,rawStart:raw,clientStart:{x:e.clientX,y:e.clientY}};draftBefore=M.clone(project);}
  else if(o&&kind!=='room'){ui.sel=ref;drag={kind,original:M.clone(o),start:p,rawStart:raw,clientStart:{x:e.clientX,y:e.clientY},end:ent.dataset.end,handle:ent.dataset.handle,index:Number(ent.dataset.index)};draftBefore=M.clone(project);}
 }else{drag={kind:'box',start:raw,current:raw,add:e.shiftKey,existing:selectionRefs()};if(!e.shiftKey)setSelection([]);}
 renderPlan();renderInspector();syncChrome();viewer?.markSelection(selectionRefs());
});
$('#plan').addEventListener('pointermove',e=>{const p=pointFrom(e,ui.tool!=='calibrate');
 if(drag?.kind==='box'){drag.current=pointFrom(e);renderPlan();return;}
 if(drag?.kind==='guide'){const g=floor().guides.find(g=>g.id===drag.id),raw=pointFrom(e);g.value=M.clamp(Math.round((drag.original.value+raw[g.axis]-drag.rawStart[g.axis])*1000)/1000,-500,500);renderPlan();return;}
 if(drag?.kind==='batch'){
  if(Math.hypot(e.clientX-drag.clientStart.x,e.clientY-drag.clientStart.y)<3&&!drag.moved)return;
  drag.moved=true;const base=draftBefore.floors.find(f=>f.id===ui.floor),raw=pointFrom(e),box=E.selectionBounds(base,drag.refs),ids=new Set(E.expandSelection(base,drag.refs,{attached:true}).map(r=>r.id));
  const snap=M.snapFurnitureMove({id:'selection-bounds',x:box.x,y:box.y,w:Math.max(.01,box.w),d:Math.max(.01,box.d),rot:0},{x:box.x+raw.x-drag.rawStart.x,y:box.y+raw.y-drag.rawStart.y},{...base,walls:base.walls.filter(o=>!ids.has(o.id)),furniture:base.furniture.filter(o=>!ids.has(o.id))},{enabled:ui.snap,threshold:M.clamp(view.w/Math.max(1,$('#plan').clientWidth)*11,.025,.25)});
  try{const next=M.clone(base);E.transformSelection(next,drag.refs,{dx:snap.x-box.x,dy:snap.y-box.y});Object.assign(floor(),next);E.assertLocksPreserved(draftBefore,project);ui.snapFeedback=ui.snap?snap:null;floor().furniture.filter(o=>ids.has(o.id)).forEach(o=>viewer?.previewFurniture(ui.floor,o));}catch(err){Object.assign(floor(),M.clone(base));if(!drag.error)toast(err.message);drag.error=err.message;}
  renderPlan();return;
 }
 if(drag?.kind==='pan'){const r=$('#plan').getBoundingClientRect();view.x=drag.startView.x-(e.clientX-drag.x)/r.width*view.w;view.y=drag.startView.y-(e.clientY-drag.y)/r.height*view.h;renderPlan();return;}if(drag&&draftBefore){const o=selected(),a=drag.original,dx=p.x-drag.start.x,dy=p.y-drag.start.y;if(!o)return;
 if(!drag.moved&&Math.hypot(e.clientX-drag.clientStart.x,e.clientY-drag.clientStart.y)<3)return;drag.moved=true;
 const base=draftBefore.floors.find(f=>f.id===ui.floor);
 if(drag.kind==='wall')M.changeWall(floor(),base,o.id,{x:a.a.x+dx,y:a.a.y+dy},{x:a.b.x+dx,y:a.b.y+dy});
 else if(drag.kind==='handle'){if(M.dist(p,a[drag.end==='a'?'b':'a'])>.15)M.changeWall(floor(),base,o.id,drag.end==='a'?p:a.a,drag.end==='b'?p:a.b);}
 else if(drag.kind==='opening-resize'){const w=floor().walls.find(w=>w.id===o.wallId);try{resizeOpening(floor(),o.id,a,drag.end,M.projection(pointFrom(e),w).offset);drag.error='';}catch(error){if(drag.error!==error.message)toast(error.message);drag.error=error.message;}}
 else if(drag.kind==='opening'){const w=floor().walls.find(w=>w.id===o.wallId);const offset=M.clamp(M.projection(p,w).offset,o.width/2,M.length(w)-o.width/2);if(M.canPlaceOpening(floor(),{...o,offset}))o.offset=offset;}
 else if(['room-vertex','solid-vertex'].includes(drag.kind)){o.poly=M.clone(a.poly);o.poly[drag.index]=[p.x,p.y];}
 else if(drag.kind==='solid'){const shift=poly=>poly.map(([x,y])=>[x+dx,y+dy]);o.poly=shift(a.poly);o.holes=(a.holes||[]).map(shift);}
 else if(drag.kind==='furniture-resize'){const raw=pointFrom(e);Object.assign(o,M.resizeFurniture(a,drag.handle,{x:raw.x-drag.rawStart.x,y:raw.y-drag.rawStart.y}));}
 else if(drag.kind==='furniture'){const raw=pointFrom(e),desired={x:a.x+raw.x-drag.rawStart.x,y:a.y+raw.y-drag.rawStart.y},snap=M.snapFurnitureMove(a,desired,floor(),{enabled:ui.snap,threshold:M.clamp(view.w/Math.max(1,$('#plan').clientWidth)*11,.025,.25)});o.x=snap.x;o.y=snap.y;ui.snapFeedback=ui.snap?snap:null;}
 else{o.x=a.x+dx;o.y=a.y+dy;}
 if(ui.sel.kind==='opening'){viewer?.update(project,{...ui,floor:ui.show==='all'?'all':ui.floor});for(const key of ['width','offset']){const input=$(`#inspector [data-prop="${key}"]`);if(input)input.value=Number(o[key].toFixed(3));}}
 if(ui.sel.kind==='furniture'){viewer?.previewFurniture(ui.floor,o);for(const key of ['x','y','w','d']){const input=$(`#inspector [data-prop="${key}"]`);if(input)input.value=Number(o[key].toFixed(3));}}
 M.normalizeOpenings(floor());try{E.assertLocksPreserved(draftBefore,project);}catch(err){Object.assign(floor(),M.clone(base));if(!drag.error)toast(err.message);drag.error=err.message;}renderPlan();return;}if(ui.start||!['select','pan','calibrate','crop'].includes(ui.tool)){ui.pointer=p;renderPlan();}});
function endDrag(cancel=false){
 if(drag?.kind==='box'){if(!cancel){const refs=E.boxSelection(floor(),drag.start,drag.current,{kind:ui.tool==='box'?ui.boxFilter:'all'}),all=drag.add?[...drag.existing,...refs]:refs;setSelection([...new Map(all.map(r=>[r.id,r])).values()]);}drag=null;if(ui.tool==='box')ui.tool='select';render();return;}
 if(draftBefore){
  if(!cancel)try{if(drag?.kind==='room-vertex')M.checkRoomEdit(floor(),selected());if(['wall','handle'].includes(drag.kind)||drag.kind==='batch'&&drag.refs.some(r=>r.kind==='wall'))floor().rooms=M.refreshRooms(floor());E.assertLocksPreserved(draftBefore,project);M.validateProject(project);}catch(e){cancel=true;toast(e.message);}
  if(cancel){project=draftBefore;ui.snapFeedback=null;}else if(JSON.stringify(project)!==JSON.stringify(draftBefore)){history(draftBefore);changed();}
  draftBefore=null;drag=null;render();
 }else drag=null;
}
$('#plan').addEventListener('pointerup',()=>endDrag());$('#plan').addEventListener('pointercancel',()=>endDrag(true));$('#plan').addEventListener('contextmenu',e=>{e.preventDefault();ui.start=null;renderPlan();});
$('#plan').addEventListener('lostpointercapture',()=>{if(drag)endDrag(true);});

function deleteSelection(){runEdit('delete');}
function duplicateSelection(){runEdit('copy');}
function scaleSelectedFurniture(factor){if(ui.sel?.kind!=='furniture'||!selected())return;mutate(()=>{const o=selected(),s=M.clamp(factor,Math.max(.1/o.w,.1/o.d),Math.min(40/o.w,40/o.d));o.w*=s;o.d*=s;});}
$('#inspector').addEventListener('click',e=>{const b=e.target.closest('[data-furniture-scale]');if(b)scaleSelectedFurniture(Number(b.dataset.furnitureScale));});
function removeCurrentFloor(){
 const last=project.floors.length===1;
 const message=last?'清空墙体、门窗、房间、家具、楼梯、自建构件、底图和屋顶，恢复为一个空白的“1 层”，保留层高。可撤销恢复。':'该层的墙体、门窗、房间、家具、楼梯和底图会一起删除，可撤销。';
 confirmDialog(last?'清空当前楼层？':'删除当前楼层？',message,()=>{
  viewer?.stopWalk();
  mutate(()=>{
   if(last){
    const f=floor();
    for(const key of ['walls','openings','rooms','furniture','stairs','solids'])f[key]=[];
    f.image=null;f.cad=null;f.guides=[];f.roomMode='auto';f.name='1 层';f.nameEdited=false;project.roof='none';
   }else{
    const index=project.floors.indexOf(floor());
    project.floors.splice(index,1);
    ui.floor=project.floors[Math.min(index,project.floors.length-1)].id;
   }
   ui.sel=null;ui.start=null;ui.pointer=null;ui.measure=null;ui.tool='select';ui.library=false;
   drag=null;draftBefore=null;
  });
  if(last)setMode(innerWidth<700?'2d':'split');
  fitPlan();viewer?.fit();
  toast(last?'本层已清空，可以重新画墙或导入图纸；Ctrl+Z 可撤销':'楼层已删除，Ctrl+Z 可撤销');
 });
}
function onProp(el){const key=el.dataset.prop;let v=el.type==='number'?Number(el.value):el.value;if(el.type==='number'&&(!Number.isFinite(v)||(el.min!==''&&v<Number(el.min))||(el.max!==''&&v>Number(el.max)))){toast('请输入有效范围内的数值');renderInspector();return;}
 mutate(()=>{const f=floor(),o=selected();if(key==='floorName'){f.name=String(v).trim().slice(0,30)||f.name;f.nameEdited=true;return;}if(key==='floorHeight'){f.height=v;return;}if(key==='imageX'){f.image.x=v;return;}if(key==='imageY'){f.image.y=v;return;}if(!o)return;
  if(ui.sel.kind==='wall'){const base=M.clone(f);if(key==='length'){const l=M.length(o),ratio=v/l;o.b={x:o.a.x+(o.b.x-o.a.x)*ratio,y:o.a.y+(o.b.y-o.a.y)*ratio};}else if(key==='angle'){const l=M.length(o),a=v*Math.PI/180;o.b={x:o.a.x+Math.cos(a)*l,y:o.a.y+Math.sin(a)*l};}else if(key==='ax'||key==='ay'){const axis=key==='ax'?'x':'y',d=v-o.a[axis];o.a[axis]+=d;o.b[axis]+=d;}else o[key]=v;
  if(['length','angle','ax','ay'].includes(key))M.changeWall(f,base,o.id,{...o.a},{...o.b});
  }else if(ui.sel.kind==='opening')updateOpening(f,o.id,{[key]:v});else Object.assign(o,{[key]:v});
 },{rooms:ui.sel?.kind==='wall'&&['length','angle','ax','ay'].includes(key)});
}
$('#inspector').addEventListener('change',e=>{const el=e.target;if(el.dataset.prop)onProp(el);else if(el.id==='furnCategory'){ui.category=Number(el.value);renderInspector();}else if(el.id==='roof')mutate(()=>project.roof=el.value);else if(el.id==='imageOpacity')mutate(()=>floor().image.opacity=Number(el.value));else if(el.id==='toggleBlueprint'){ui.blueprint=el.checked;render();}});
$('#inspector').addEventListener('change',e=>{if(e.target.id==='toggleCAD')mutate(()=>floor().cad.hidden=!e.target.checked);});
$('#inspector').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.doorFlip){const o=selected();if(ui.sel?.kind==='opening'&&o?.type==='door')mutate(()=>updateOpening(floor(),o.id,{[b.dataset.doorFlip]:-(o[b.dataset.doorFlip]||1)}));return;}if(b.dataset.floor){setFloor(b.dataset.floor);return;}if(b.dataset.mat){mutate(()=>selected().mat=b.dataset.mat);return;}if(b.dataset.item){ui.furnitureItem=LIB[ui.category].items[Number(b.dataset.item)];setTool('furniture');toast('在平面图中点击放置 '+ui.furnitureItem[1]);return;}const actions={deleteSelection,duplicateSelection,editSolidHeight:()=>{modeling.open('push');setMode(innerWidth<700?'3d':'split');},deselect:()=>{ui.sel=null;renderInspector();renderPlan();viewer?.markSelection(null);},duplicateFloor:()=>{if(project.floors.length>=10)return toast('最多支持 10 层');mutate(()=>{const n=M.duplicateFloor(floor(),nextFloorName(project.floors));project.floors.push(n);ui.floor=n.id;ui.sel=null;});fitPlan();},deleteFloor:removeCurrentFloor,importPlanSide:importDialog,removeCADReference:()=>mutate(()=>floor().cad=null),calibrate:()=>setTool('calibrate'),cropImage:()=>setTool('crop'),recognize:recognizeDialog,removeImage:()=>mutate(()=>floor().image=null),findRooms:()=>confirmDialog('重新计算房间轮廓？','重新计算自动分区，保留手工修复的分区；原有开放空间分区可能合并。可撤销。',()=>mutate(()=>{floor().roomMode='auto';floor().rooms=M.refreshRooms(floor());}))};actions[b.id]?.();});
$$('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));$('#viewSeg').onclick=e=>{if(e.target.dataset.view)setMode(e.target.dataset.view);};$('#floorTabs').onclick=e=>{if(e.target.dataset.floor)setFloor(e.target.dataset.floor);};$('#addFloor').onclick=()=>{if(project.floors.length>=10)return toast('最多支持 10 层');mutate(()=>{const f=M.makeFloor(nextFloorName(project.floors));project.floors.push(f);ui.floor=f.id;ui.sel=null;});fitPlan();setMode('split');};$('#undo').onclick=undo;$('#redo').onclick=redo;$('#projectName').onchange=e=>mutate(()=>project.name=e.target.value.trim()||'未命名建筑');$('#toggleInspector').onclick=()=>$('#inspector').classList.toggle('open');
$$('[data-plan]').forEach(b=>b.onclick=()=>{const a=b.dataset.plan;if(a==='fit')fitPlan();else if(a==='in'||a==='out'){const ratio=a==='in'?.8:1.25;view.x+=view.w*(1-ratio)/2;view.y+=view.h*(1-ratio)/2;view.w*=ratio;view.h*=ratio;renderPlan();}else{ui[a]=!ui[a];if(a==='snap'){ui.snapFeedback=null;toast(ui.snap?'吸附已开启：家具贴墙、对齐家具、墙角墙线和 10 厘米网格':'吸附已关闭，现在可自由移动');}renderPlan();syncChrome();}});
$('#fit3d').onclick=()=>viewer?.fit();$('#top3d').onclick=()=>viewer?.fit(true);$('#replay').onclick=()=>viewer?.replay();$('#walk').onclick=()=>{if(!floor().walls.length)return toast('请先画出房间再进入漫游');setMode('3d');try{viewer?.startWalk(ui.floor);}catch(error){toast(error.message);}};$('#exitWalk').onclick=()=>viewer?.stopWalk();$('#explode').onclick=()=>{ui.exploded=!ui.exploded;ui.show='all';render();viewer?.fit();};$('#showAll').onclick=()=>{ui.show=ui.show==='all'?'current':'all';render();viewer?.fit();};$('#cut3d').onclick=()=>{if(ui.cut)modeling.setSectionEnabled(false);else modeling.open('section');};for(const[id,k]of[['furniture3d','furniture'],['night3d','night']])$('#'+id).onclick=()=>{ui[k]=!ui[k];render();};
$$('[data-key]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);viewer?.keys.add(b.dataset.key);};b.onpointerup=b.onpointercancel=()=>viewer?.keys.delete(b.dataset.key);});
document.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select,[contenteditable]')||$('#dialog').open||viewer?.walk)return;if((e.ctrlKey||e.metaKey)&&['g','d','a'].includes(e.key.toLowerCase())){e.preventDefault();const key=e.key.toLowerCase();if(key==='g')runEdit(e.shiftKey?'ungroup':'group');else if(key==='d')runEdit('copy');else{setSelection(E.expandSelection(floor(),E.entities(floor()).filter(r=>!E.hidden(floor(),r)&&!E.locked(floor(),r)&&(ui.objectFilter==='all'||r.kind===ui.objectFilter))));render();}return;}if(ui.tool==='select'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&selectionRefs().length){e.preventDefault();const step=e.shiftKey?.1:.01,refs=selectionRefs();mutate(()=>setSelection(E.transformSelection(floor(),refs,{dx:e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,dy:e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0})),{rooms:refs.some(r=>r.kind==='wall')});return;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(ui.tool==='repair'&&!e.shiftKey&&(ui.repairPoints.length||ui.repairEnds.length)){ui.repairMode==='floor'?ui.repairPoints.pop():ui.repairEnds.pop();render();}else e.shiftKey?redo():undo();return;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveJSON();return;}if(ui.tool==='repair'&&e.key==='Enter'){e.preventDefault();if(ui.repairMode==='floor')finishRoomRepair();else if(ui.repairMode==='connect'&&ui.repairEnds.length===2)mutate(()=>{M.connectWallEnds(floor(),...ui.repairEnds);ui.repairEnds=[];},{rooms:true});return;}if(ui.tool==='repair'&&(e.key==='Backspace'||e.key==='Delete')){e.preventDefault();ui.repairMode==='floor'?ui.repairPoints.pop():ui.repairEnds.pop();render();return;}if(e.key==='Escape'){if(drag)endDrag(true);ui.start=null;ui.measure=null;setTool('select');}if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteSelection();}if(e.key.toLowerCase()==='v')setTool('select');if(e.key.toLowerCase()==='w')setTool('wall');if(e.key.toLowerCase()==='f')fitPlan();});

function modal(title,body,actions){const d=$('#dialog');d.className='';d.innerHTML=`<button class="modal-close" aria-label="关闭">×</button><div class="dialog-body"><h2 class="dialog-title">${title}</h2>${body}</div><div class="dialog-actions">${actions}</div>`;d.querySelector('.modal-close').onclick=()=>d.close();if(!d.open)d.showModal();return d;}
function confirmDialog(title,body,cb){modal(title,`<p class="muted">${body}</p>`,'<button class="btn" id="cancelAction">取消</button><button class="btn primary" id="confirmAction">确定</button>');$('#cancelAction').onclick=()=>$('#dialog').close();$('#confirmAction').onclick=()=>{$('#dialog').close();cb();};}
function importDialog(){modal('导入当前楼层的图纸','<p class="muted">支持 DXF、PDF、JPG、PNG、WebP，最大 30 MB。图纸只在本机处理。</p><button class="drop-zone full" id="choosePlan"><div>'+ico('upload')+'<b>选择 CAD、图片或 PDF 图纸</b><span class="muted">可将文件拖到这里</span></div></button><label class="field"><span>PDF 页码</span><input id="pdfPage" type="number" min="1" value="1" aria-label="PDF 页码"></label><p class="muted">DXF：选择单位、墙体图层和范围，预览后生成模型。DWG 请先在 CAD 中另存为 DXF。图片和 PDF 可先识别，稍后再校准。</p>','<button class="btn" id="closeImport">关闭</button>');$('#closeImport').onclick=()=>$('#dialog').close();$('#choosePlan').onclick=()=>$('#planFile').click();$('#choosePlan').ondragover=e=>{e.preventDefault();};$('#choosePlan').ondrop=e=>{e.preventDefault();if(e.dataTransfer.files[0])importPlan(e.dataTransfer.files[0]);};}
async function importPlan(file){if(/\.dwg$/i.test(file.name)){toast('DWG 请先在 CAD 中另存为 DXF，再通过这里导入。');$('#planFile').value='';return;}if(/\.dxf$/i.test(file.name)){try{const {openCADImport}=await import('./cad-dialog.js');await openCADImport({file,$,floor,modal,esc,mutate,setMode,setTool,fitPlan,viewer,toast,ui});}catch(e){toast(e.message||'CAD 导入失败');}finally{$('#planFile').value='';}return;}const page=Number($('#pdfPage')?.value||1),floorId=ui.floor;try{toast('正在读取图纸…');const i=await readPlan(file,page);if(ui.floor!==floorId)return toast('楼层已切换，请在目标楼层重新导入');mutate(()=>{floor().image={...i,x:0,y:0,width:15,opacity:.55,calibrated:false};});$('#dialog').close();setMode('2d');fitPlan();toast('图纸已导入，点击“先识别建模”即可预览；校准尺寸可以稍后再做');}catch(e){console.error(e);toast(e.message||'图纸读取失败');}finally{$('#planFile').value='';}}
$('#importPlan').onclick=importDialog;$('#planFile').onchange=e=>{if(e.target.files[0])importPlan(e.target.files[0]);};
function calibrationDialog(a,b){
 const f=floor(),image=f.image;if(!image)return setTool('select');
 const hasModel=['walls','rooms','furniture','stairs'].some(k=>f[k].length);
 setTool('select');
 const body='<p class="muted">输入刚才两点之间，图纸标注的真实长度。比如图上写着 <b>6000</b>，填 <b>6000</b>，单位选「毫米」，就是 6 米。</p><div class="field-row"><label class="field"><span>图纸标注的长度</span><input id="knownLength" type="number" min=".1" step="any" placeholder="例如 6000" aria-label="图纸标注的长度"></label><label class="field"><span>单位</span><select id="knownUnit" aria-label="长度单位"><option value="mm">毫米（mm）</option><option value="m">米（m）</option></select></label></div>'+(hasModel?'<label class="toggle-row calibration-scale"><span>同时调整本层模型的平面尺寸</span><input id="scaleExistingModel" type="checkbox" '+(!image.calibrated?'checked':'')+'></label><p class="muted">勾选后，墙、门窗宽度、家具和楼梯随底图一起缩放；层高保持不变。</p>':'')+'<p class="muted">找不到尺寸数字也没关系，可以先识别预览。</p>';
 modal('这两点之间，图上标了多长？',body,'<button class="btn" id="cancelCalibrate">取消</button><button class="btn" id="skipCalibrationDialog">先识别预览</button><button class="btn primary" id="applyCalibrate">应用尺寸</button>');
 $('#knownLength').focus();
 $('#cancelCalibrate').onclick=()=>$('#dialog').close();
 $('#skipCalibrationDialog').onclick=()=>{$('#dialog').close();recognizeDialog();};
 $('#applyCalibrate').onclick=()=>{
  const n=Number($('#knownLength').value)*($('#knownUnit').value==='mm'?.001:1),scaleModel=!!$('#scaleExistingModel')?.checked;
  if(!Number.isFinite(n)||n<.1||n>200)return toast('请填写真实长度：100–200000 毫米，或 0.1–200 米');
  const calibrated=M.clone(floor());
  try{M.calibrateFloor(calibrated,a,b,n,{scaleModel});}catch(e){return toast(e.message);}
  mutate(()=>Object.assign(floor(),calibrated));$('#dialog').close();fitPlan();viewer?.fit();
  toast(scaleModel?'底图与本层模型尺寸已同步校准':'底图尺寸已校准');
 };
}
function helpDialog(){modal('从图纸到可以走进去的空间',`<p class="muted">先选楼层，在平面上建模，三维会同步更新。</p><div class="help-grid"><div><b>01　导入与校准</b><p>导入后可先识别预览，不必先知道尺寸。需要精确尺寸时，点击图上标注线的两端，直接输入数字并选择毫米或米。</p></div><div><b>02　画墙与门窗</b><p>画墙可连续点选；房间工具画矩形。点击墙体放门窗，选中后在属性里改尺寸。</p></div><div><b>03　楼层与楼梯</b><p>新增或复制楼层，楼层共用同一平面坐标。分层查看可检查对齐；楼梯连接上一层。</p></div><div><b>04　保存与漫游</b><p>自动保存在此浏览器；导出 JSON 可备份或换电脑。GLB 用于其他三维工具，STL 为米制网格。</p></div></div><div class="info-note">辅助识别适用于清晰的横竖墙线图，门洞类型和尺寸需要核对。当前为方案白模；STL 尚未做打印封闭性修复。</div>`,'<button class="btn primary" id="closeHelp">开始使用</button>');$('#closeHelp').onclick=()=>$('#dialog').close();}
$('#help').onclick=$('#railHelp').onclick=helpDialog;
function saveJSON(){download(project.name+'.json',new Blob([JSON.stringify(project,null,2)],{type:'application/json'}));toast('已导出完整项目，包含所有楼层和底图');}
async function saveWalkthrough(){
 const snapshot=M.clone(project),floorId=ui.floor;toast('正在打包离线漫游网页…');
 const [runtime,licenses]=await Promise.all(['walkthrough-runtime.js','walkthrough-licenses.txt'].map(async file=>{const response=await fetch(new URL(import.meta.env.BASE_URL+file,document.baseURI));if(!response.ok)throw new Error('无法加载漫游资源，请重新打开工作台后重试');return response.text();}));
 const html=createWalkthroughHTML(snapshot,{runtime,licenses,floorId}),blob=new Blob([html],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob);
 const dialog=modal('漫游网页已生成',`<p class="muted">${esc(snapshot.name)} · ${(blob.size/1024/1024).toFixed(2)} MB</p><p class="muted">下载后双击 HTML 即可进入室内，也可把这个文件发送给别人。鼠标拖动转向，WASD 或屏幕方向按钮行走。</p>`,'<a class="btn primary" id="downloadWalkthrough">下载漫游 HTML</a>');
 Object.assign($('#downloadWalkthrough'),{href:url,download:snapshot.name+'-漫游.html'});dialog.addEventListener('close',()=>setTimeout(()=>URL.revokeObjectURL(url),60000),{once:true});
}
$('#fileMenu').onclick=()=>{$('#filePopup').hidden=!$('#filePopup').hidden;$('#exportPopup').hidden=true;};$('#exportMenu').onclick=()=>{$('#exportPopup').hidden=!$('#exportPopup').hidden;$('#filePopup').hidden=true;};document.addEventListener('click',e=>{if(!e.target.closest('.menu-wrap')){$('#filePopup').hidden=true;$('#exportPopup').hidden=true;}});
$$('[data-file]').forEach(b=>b.onclick=()=>{const action=b.dataset.file;$('#filePopup').hidden=true;if(action==='save')saveJSON();else if(action==='open')$('#projectFile').click();else confirmDialog(action==='new'?'新建空白建筑？':'打开样例建筑？','当前方案将被替换，可使用撤销恢复。需要长期保留时，请先保存项目 JSON。',()=>{history(M.clone(project));project=action==='new'?M.blankProject():action==='reference'?M.referenceProject():M.villaProject();ui.floor=project.floors[0].id;ui.sel=null;ui.start=null;viewer?.stopWalk();render();fitPlan();viewer?.fit();changed();});});
$('#projectFile').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>40e6)throw new Error('项目文件过大（最多 40 MB）');const raw=JSON.parse(await file.text()),next=raw.version===2?M.validateProject(raw):M.migrateLegacy(raw);history(M.clone(project));project=next;ui.floor=project.floors[0].id;ui.sel=null;ui.start=null;viewer?.stopWalk();render();fitPlan();viewer?.fit();changed();toast('项目已打开');}catch(err){toast(err.message||'项目格式无效');}finally{e.target.value='';}};
$$('[data-export]').forEach(b=>b.onclick=async()=>{const format=b.dataset.export;$('#exportPopup').hidden=true;try{if(format==='html'){await saveWalkthrough();}else if(format==='svg'){const svg=$('#plan').cloneNode(true);svg.setAttribute('width','1600');svg.setAttribute('height',String(Math.round(1600*view.h/view.w)));download(project.name+'-'+floor().name+'.svg',new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}));}else if(!viewer)throw new Error('三维引擎未启动');else if(format==='png')viewer.screenshot();else{toast('正在导出模型…');await viewer.export(format);toast(format==='stl'?'已导出 STL 米制网格，打印前需检查封闭性和缩放':'已导出 GLB 模型');}}catch(e){console.error(e);toast('导出失败：'+e.message);}});

async function recognizeDialog(){
 if(!floor().image)return toast('请先导入图纸');
 setTool('select');
 const targetFloor=ui.floor,planImage=M.clone(floor().image),estimated=!planImage.calibrated;
 const height=planImage.width*planImage.pixelHeight/planImage.pixelWidth,hasAuto=floor().walls.some(w=>w.inferred);
 const scaleNote=estimated?'<div class="scale-note"><b>尺寸可以稍后校准</b><span>暂按图宽约 '+Number(planImage.width.toFixed(2))+' 米建模，长度与面积为估算值。</span></div>':'';
 const d=modal('识别墙体 · 对照原图确认',`<p class="muted">分析实心墙、双线墙、墙角与柱体。先预览，确认后生成可编辑模型。</p><div class="recognition-layout"><div class="recognition-canvas-column"><div class="recognition-image-wrap" style="aspect-ratio:${planImage.pixelWidth}/${planImage.pixelHeight}"><img id="recognitionImage" src="${esc(planImage.data)}" alt="待识别的图纸"><svg id="recognitionOverlay" viewBox="${planImage.x} ${planImage.y} ${planImage.width} ${height}" aria-label="识别结果预览"></svg></div><div class="recognition-legend"><span class="accepted">● 绿色：将加入</span><span class="review">● 橙色虚线：待确认</span><span>点线条可切换</span></div><div class="recognition-preview-tools"><button class="btn small" id="resetDetect" disabled>恢复推荐选择</button><label><input id="showDetectReview" type="checkbox" checked> 显示待确认线条</label></div></div><div class="recognition-settings">${scaleNote}<label class="toggle-row">自动适应图纸深浅<input id="detectAutoThreshold" type="checkbox" checked></label><div class="field-row"><label class="field"><span>黑白阈值</span><input id="detectThreshold" type="number" min="30" max="245" value="130" disabled aria-label="黑白阈值"></label><label class="field"><span>短墙参考长度 / m</span><input id="detectLength" type="number" min=".2" max="4" step=".05" value=".55" aria-label="短墙参考长度 / m"></label></div><p class="muted">连接墙角的短墙会优先保留。橙色线条可能是墙，也可能是家具，请对照原图选择。</p><label class="toggle-row">推测门窗洞口<input id="detectOpenings" type="checkbox" checked></label><label class="field"><span>应用方式</span><select id="detectApplyMode"><option value="replace-auto">替换本层旧的自动识别结果</option><option value="append">保留旧结果，追加本次选择</option></select></label><p class="muted" id="detectApplyHint">${hasAuto?'将替换旧的自动墙及其门窗（含后续修改），保留手画墙和家具。':'将加入本层，保留已有的手画墙和家具。'}整次操作可撤销。</p><div id="recognitionResult" class="recognition-preview" role="status" aria-live="polite">点击「开始识别」查看叠加结果。图纸只在本机处理。</div></div></div>`,'<button class="btn" id="cancelDetect">取消</button><button class="btn primary" id="runDetect">开始识别</button><button class="btn primary" id="applyDetect" hidden>应用所选结果</button>');
 d.classList.add('recognition-dialog');
 const runButton=$('#runDetect'),applyButton=$('#applyDetect'),resultBox=$('#recognitionResult'),overlay=$('#recognitionOverlay');
 let result=null,selection=new Set();
 $('#cancelDetect').onclick=()=>d.close();
 const drawPreview=()=>{
  if(!result){overlay.innerHTML='';return;}
  const reviewIds=new Set(result.reviewWalls.map(w=>w.id)),showReview=$('#showDetectReview').checked;
  const candidates=[...result.reviewWalls,...result.walls],visible=candidates.filter(w=>showReview||!reviewIds.has(w.id)||selection.has(w.id));
  const crop=planImage.crop;
  overlay.innerHTML=(crop?`<rect x="${crop.x}" y="${crop.y}" width="${crop.w}" height="${crop.h}" fill="none" stroke="#6e83a0" stroke-width=".025" stroke-dasharray=".1 .08"/>`:'')+visible.map(w=>{
   const chosen=selection.has(w.id),review=reviewIds.has(w.id),state=chosen?'accepted':review?'review':'excluded',kind=w.structuralKind==='column'?'柱体':'墙线';
   return`<g data-candidate="${w.id}" class="detect-candidate ${state}" role="button" tabindex="0" aria-label="${chosen?'取消选择':'选择'}${kind}" aria-pressed="${chosen}"><title>${kind} ${M.length(w).toFixed(2)} 米 · ${chosen?'将加入':review?'待确认':'已排除'}</title><line x1="${w.a.x}" y1="${w.a.y}" x2="${w.b.x}" y2="${w.b.y}" stroke-width="${Math.max(.045,w.thickness)}" class="detect-line"/><line x1="${w.a.x}" y1="${w.a.y}" x2="${w.b.x}" y2="${w.b.y}" stroke="transparent" stroke-width="${Math.max(.15,w.thickness)}"/></g>`;
  }).join('');
  const ops=result.openings.filter(o=>selection.has(o.wallId));
  overlay.innerHTML+=ops.map(o=>{const w=result.walls.find(w=>w.id===o.wallId),a=M.onWall(w,o.offset-o.width/2),b=M.onWall(w,o.offset+o.width/2);return`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#287dcd" stroke-width=".045" stroke-dasharray=".09 .06" pointer-events="none"><title>候选${o.type==='door'?'门':'窗'}，应用后可修改</title></line>`;}).join('');
  const unresolved=result.reviewWalls.filter(w=>!selection.has(w.id)).length;
  resultBox.textContent=`已选 ${selection.size} 段墙 / 柱，${ops.length} 个候选洞口；另有 ${unresolved} 段待确认。蓝色虚线为候选门窗，类型和尺寸请核对。`;
  applyButton.hidden=false;applyButton.disabled=!selection.size;$('#resetDetect').disabled=false;
 };
 const toggleCandidate=e=>{const el=e.target.closest('[data-candidate]');if(!result||!el)return;const id=el.dataset.candidate;selection.has(id)?selection.delete(id):selection.add(id);drawPreview();overlay.querySelector(`[data-candidate="${id}"]`)?.focus({preventScroll:true});};
 overlay.onclick=toggleCandidate;overlay.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleCandidate(e);}};
 $('#resetDetect').onclick=()=>{selection=new Set(result.walls.map(w=>w.id));drawPreview();};
 $('#showDetectReview').onchange=drawPreview;
 $('#detectApplyMode').onchange=e=>{$('#detectApplyHint').textContent=e.target.value==='append'?'追加会保留旧的自动墙，请留意重复墙体。整次操作可撤销。':hasAuto?'将替换旧的自动墙及其门窗（含后续修改），保留手画墙和家具。整次操作可撤销。':'将加入本层，保留已有的手画墙和家具。整次操作可撤销。';};
 for(const id of ['detectAutoThreshold','detectThreshold','detectLength','detectOpenings'])$('#'+id).onchange=()=>{
  $('#detectThreshold').disabled=$('#detectAutoThreshold').checked;result=null;selection.clear();drawPreview();applyButton.hidden=true;$('#resetDetect').disabled=true;resultBox.textContent='选项已修改，请重新识别。';
 };
 runButton.onclick=async()=>{
  const options={threshold:$('#detectAutoThreshold').checked?undefined:Number($('#detectThreshold').value),minLength:Number($('#detectLength').value),inferOpenings:$('#detectOpenings').checked};
  if(options.minLength<.2||options.minLength>4||!Number.isFinite(options.minLength)||options.threshold!==undefined&&(options.threshold<30||options.threshold>245||!Number.isFinite(options.threshold)))return toast('请检查识别选项的数值范围');
  result=null;selection.clear();drawPreview();applyButton.hidden=true;$('#resetDetect').disabled=true;
  const controls=[...d.querySelectorAll('.recognition-settings input')];controls.forEach(el=>el.disabled=true);
  try{runButton.disabled=true;resultBox.textContent='正在分析线宽、双线墙与连接关系…';const {detectPlan}=await import('./recognition.js');const detected=await detectPlan(planImage,options);if(!d.open||!d.contains(resultBox))return;result=detected;selection=new Set(result.walls.map(w=>w.id));drawPreview();if(!result.walls.length&&!result.reviewWalls.length)resultBox.textContent='未找到可靠墙线。可框选建筑区域或调整图纸深浅后重试。';}
  catch(e){resultBox.textContent=e.message;}finally{runButton.disabled=false;runButton.textContent='重新识别';controls.forEach(el=>el.disabled=false);const threshold=d.querySelector('#detectThreshold');if(threshold)threshold.disabled=d.querySelector('#detectAutoThreshold').checked;}
 };
 applyButton.onclick=()=>{
  if(!result||!selection.size)return;
  if(ui.floor!==targetFloor||JSON.stringify(floor().image)!==JSON.stringify(planImage))return toast('图纸已变化，请重新识别');
  mutate(()=>{M.applyRecognition(floor(),result,{selectedIds:[...selection],mode:$('#detectApplyMode').value});ui.sel=null;});
  d.close();setMode(innerWidth<700?'3d':'split');fitPlan();viewer?.fit();
  toast(estimated?'模型已生成，当前尺寸为估算值；知道真实长度后可再校准':'识别结果已加入，可逐条修改；Ctrl+Z 撤销本次添加');
 };
}
render();if(saveOnStart)changed();requestAnimationFrame(()=>{fitPlan();viewer?.fit();});const ro=new ResizeObserver(()=>{renderPlan();viewer?.resize();});ro.observe($('#views'));
addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
// Read-only diagnostics for local QA; no mutation shortcuts are exposed.
Object.defineProperty(window,'__studio',{value:{getProject:()=>M.clone(project),getSelection:()=>M.clone(ui.sel),getView:()=>({...view}),getRenderer:()=>viewer?{calls:viewer.renderer.info.render.calls,triangles:viewer.renderer.info.render.triangles,walk:viewer.walk,camera:viewer.camera.position.toArray(),rotation:viewer.camera.rotation.toArray(),floorId:viewer.walkFloorId}:null}});
