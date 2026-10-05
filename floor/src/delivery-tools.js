import * as R from './renovation.js';
import * as D from './delivery-model.js';
import * as Q from './quantities.js';
import {annotationItems,itemsSVG,drawingSheets,sheetSVG,exportDrawingPDF,escapeXML as esc,planScene,elevationScene,itemsBounds} from './drawings.js';
import {saveLocalScheme,saveConfirmedRevision,listLocalProjects,download} from './storage.js';
import {createWalkthroughHTML} from './walkthrough-export.js';
import {validateProject,clone} from './model.js';
import './delivery.css';

const n=(v,d=0)=>v===''||v==null?d:Number(v),mm=v=>Math.round(v*1000),uid=()=>crypto.randomUUID();
const button=(label,action,id='')=>`<button type="button" data-action="${action}" data-id="${esc(id)}">${label}</button>`;
const option=(value,label,selected)=>`<option value="${esc(value)}" ${value===selected?'selected':''}>${esc(label)}</option>`;
const select=(name,label,entries,value)=>`<label>${label}<select name="${name}">${entries.map(([v,t])=>option(v,t,value)).join('')}</select></label>`;
const input=(name,label,value='',type='text',extra='')=>`<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
const num=(name,label,value,extra='')=>input(name,label,value,'number',`step="any" ${extra}`);
const form=(action,body,submit)=>`<form data-form="${action}" class="delivery-form">${body}<button class="primary" type="submit">${submit}</button></form>`;
const empty='<p class="delivery-muted">暂无记录。</p>';
const date=d=>d?new Date(d).toLocaleString('zh-CN'):'';
const categories={walls:'墙体',openings:'门窗',furniture:'家具',solids:'自建构件',stairs:'楼梯'};
const kinds={walls:'wall',openings:'opening',furniture:'furniture',solids:'solid',stairs:'stair'};

export function installDeliveryTools(ctx){
 const {$,ui,floor,getProject,mutate,toast,setTool,setMode,render,viewer,selectionRefs,switchProject,saveNow}=ctx;
 let tab='drawings',placement=null,firstAnchor=null,library=[],archive=null,busy=false,previewPhase='proposed',trace=null,phasePreviews={},downloadUrl=null;
 let output={paper:'A3',scale:50,phases:['proposed'],elevations:true,points:true};
 const dialog=document.createElement('dialog');dialog.id='deliveryDialog';document.body.append(dialog);
 const launch=document.createElement('button');launch.id='deliveryButton';launch.className='btn';launch.textContent='交付与报价';$('.top-actions').prepend(launch);
 launch.onclick=()=>open();
 const current=()=>getProject(),source=()=>archive||current();
 const safeName=p=>`${p.name}-${R.revisionLabel(p)}`.replace(/[<>:"/\\|?*]/g,'-');
 const modify=fn=>{const ok=mutate(()=>{R.ensureDelivery(current());R.assignCodes(current());fn();R.validateDelivery(current());});if(ok)draw();return ok;};
 function open(which=tab){tab=which;archive=null;trace=null;phasePreviews={};R.ensureDelivery(current());R.assignCodes(current());ctx.changed();draw();dialog.showModal();if(tab==='versions')refreshLibrary();}
 function status(message,error=false){const box=dialog.querySelector('#deliveryStatus');if(box){box.textContent=message;box.classList.toggle('error',error);}else toast(message);}
 function exported(name,blob,message){if(downloadUrl)URL.revokeObjectURL(downloadUrl);downloadUrl=download(name,blob,{keepUrl:true});status(message+'；若未自动保存，请点此下载：');const a=document.createElement('a');a.href=downloadUrl;a.download=name;a.textContent=name;dialog.querySelector('#deliveryStatus').append(a);}
 function close(){dialog.close();if(previewPhase!=='proposed'){previewPhase='proposed';render();}}
 dialog.addEventListener('cancel',()=>{previewPhase='proposed';render();});
 function commonHeader(){return `<header><div><b>方案交付</b><p>${esc(current().name)} · ${esc(R.revisionLabel(current()))}</p></div>${button('关闭','close')}</header><nav>${Object.entries({drawings:'出图',renovation:'拆改与依据',dimensions:'尺寸与说明',elevations:'墙面立面',points:'水电点位',quantities:'工程量 / 报价',versions:'本地版本'}).map(([key,label])=>`<button type="button" data-tab="${key}" class="${tab===key?'active':''}">${label}</button>`).join('')}</nav><p id="deliveryStatus" role="status"></p>`;}
 function draw(){
  if(downloadUrl){URL.revokeObjectURL(downloadUrl);downloadUrl=null;}
  if(!current().delivery)R.ensureDelivery(current());
  dialog.innerHTML=commonHeader()+`<div class="delivery-body">${({drawings:drawingsPanel,renovation:renovationPanel,dimensions:dimensionsPanel,elevations:elevationsPanel,points:pointsPanel,quantities:quantitiesPanel,versions:versionsPanel})[tab]()}</div>`;
 }
 function floorSelect(){return select('floorId','楼层',current().floors.map(f=>[f.id,f.name]),floor().id);}
 function drawingsPanel(){
  const p=source();let sheets=[],error='';try{sheets=drawingSheets(p,output);}catch(e){error=e.message;}
  return `<p>按图框实际比例输出，所有楼层合并为一份 PDF。隐藏与锁定只影响编辑，不改变交付范围。</p>${archive?`<p class="delivery-banner">正在查看留档：${esc(R.revisionLabel(archive))} · ${date(archive.delivery.issuedAt)} ${button('返回当前方案','clear-archive')}</p>`:''}`+
   form('output',select('paper','图幅',[['A3','A3 横向'],['A4','A4 横向']],output.paper)+select('scale','比例',[20,25,50,75,100,150,200].map(v=>[String(v),'1:'+v]),String(output.scale))+Object.entries(R.PHASES).map(([v,label])=>`<label class="check"><input type="checkbox" name="phase" value="${v}" ${output.phases.includes(v)?'checked':''}>${label}</label>`).join('')+`<label class="check"><input type="checkbox" name="elevations" ${output.elevations?'checked':''}>关键墙面立面</label><label class="check"><input type="checkbox" name="points" ${output.points?'checked':''}>点位图 / 定位表</label>`,'更新预览')+
   `<div class="delivery-actions">${button('导出整套 PDF','pdf')}${button('导出版本清单 CSV','csv')}${button('导出此版 JSON','json')}${button('导出此版漫游 HTML','html')}</div>${error?`<p class="delivery-error">${esc(error)}</p>`:`<p class="delivery-muted">共 ${sheets.length} 页 · 打印时选择“实际大小 / 100%”</p><div class="drawing-previews">${sheets.map(s=>`<figure>${sheetSVG(s)}<figcaption>${esc(s.title)}</figcaption></figure>`).join('')}</div>`}`;
 }
 function renovationPanel(){
  const p=current(),d=p.delivery,f=floor();
  return `<p>先留存原始户型，再开始拆改。原始构件删除会记为拆除；改动原墙位置或洞口尺寸会保留拆除记录并建立新建构件。</p><div class="delivery-actions">${d.baseline?`<span>原始户型已留档 ${date(d.baseline.capturedAt)}</span>`:button('将当前户型留作原始图','baseline')}${Object.entries(R.PHASES).map(([key,label])=>button('三维 · '+label,'phase3d',key)).join('')}</div>`+
   form('source',select('source','尺寸依据',[['estimated','估算 / 未校准'],['calibrated','按图校准'],['measured','现场复核']],d.source)+input('sourceNote','依据 / 测量日期 / 说明',d.sourceNote,'text','maxlength="1000"'),'保存依据')+
   `<p class="delivery-muted">结构属性与锁定分开记录。未确认承重性质和依据的拆墙会进入出图复核说明。</p><div class="phase-previews">${Object.entries(phasePreviews).map(([key,url])=>`<figure><img src="${url}" alt="${R.PHASES[key]}三维预览"><figcaption>${R.PHASES[key]}</figcaption></figure>`).join('')}</div><h3>${esc(f.name)} · 构件施工状态</h3><div class="delivery-table-wrap"><table><thead><tr><th>编号 / 构件</th><th>状态</th><th>结构性质（墙）</th><th>核实依据</th><th></th></tr></thead><tbody>`+
   Object.entries(categories).flatMap(([list,label])=>(f[list]||[]).map(o=>`<tr data-entity="${esc(o.id)}" data-kind="${kinds[list]}"><td>${esc(o.code||'')} ${esc(o.name||label)}</td><td>${select('status','',Object.entries(R.STATUS_NAMES),R.constructionStatus(o))}</td><td>${list==='walls'?select('structure','',[['unknown','未确认'],['bearing','承重'],['nonbearing','非承重']],o.renovation?.structure||'unknown'):'—'}</td><td>${list==='walls'?input('evidence','',o.renovation?.evidence||'','text','placeholder="图纸编号 / 现场核实说明"'):''}</td><td>${button('保存','entity-save')}${button('查看','entity-trace',o.id)}</td></tr>`)).join('')+`</tbody></table></div>${traceMarkup()}`;
 }
 function dimensionsPanel(){
  const f=floor();return `<h3>${esc(f.name)} · 保存并关联到构件的标注</h3><p>在画布依次点两个参照点；靠近墙端、墙面、洞口边、家具边或角时自动关联。空白处是自由参照，标有 *。长度自动计算，不能改成任意数字。手工标注用于当前布置图。</p>`+form('auto-dims',select('phase','自动标注图纸',Object.entries(R.PHASES).filter(([v])=>v!=='changes'),'proposed'),'自动添加总尺寸 / 墙长 / 门窗定位')+
   form('place-dim',select('axis','方向',[['aligned','沿两点'],['horizontal','水平'],['vertical','垂直']],'aligned')+num('offset','标注偏移 / m',.45)+input('label','说明（可选）'),'到画布点两个参照')+
   form('place-note',input('text','引注文字','','text','required maxlength="1000"')+num('dx','文字水平偏移 / m',.8)+num('dy','文字竖向偏移 / m',-.6),'到画布放置引注')+
   (f.delivery.dimensions.length?f.delivery.dimensions.map(d=>{const v=D.dimensionValue(R.phaseFloor(current(),f.id,d.phase||'proposed'),d);return form('edit-dim',`<input type="hidden" name="id" value="${d.id}"><strong>${v.error?esc(v.error)+' · 待复核':mm(v.value)+' mm'+(v.manual?' *':'')}</strong>`+input('label','说明',d.label)+select('axis','方向',[['aligned','沿两点'],['horizontal','水平'],['vertical','垂直']],d.axis)+num('offset','偏移 / m',d.offset)+button('删除','remove-dim',d.id),'保存标注');}).join(''):empty)+
   f.delivery.notes.map(o=>form('edit-note',`<input type="hidden" name="id" value="${o.id}">`+input('text','引注',o.text)+num('dx','X 偏移 / m',o.dx)+num('dy','Y 偏移 / m',o.dy)+button('删除','remove-note',o.id),'保存说明')).join('');
 }
 const wallOptions=()=>R.phaseFloor(current(),floor().id).walls.map(w=>[w.id,`${w.code||'墙'} · ${D.wallBasis(w).length.toFixed(2)} m`]);
 function elevationsPanel(){
  const f=floor();return `<h3>${esc(f.name)} · 关键墙面立面</h3><p>A / B 表示墙线两侧，B 面左右镜像。投影深度控制附近家具和柜体的可见范围。高度以完成地面为零。</p>`+
   form('elevation',select('wallId','墙体',wallOptions(),selectionRefs().find(r=>r.kind==='wall')?.id)+select('side','朝向',[['1','A 面'],['-1','B 面']],'1')+num('depth','投影深度 / m',1.2,'min="0.05" max="30"')+input('name','立面名称（可选）'),'添加立面')+
   (f.delivery.elevations.length?f.delivery.elevations.map(e=>form('edit-elevation',`<input type="hidden" name="id" value="${e.id}">`+input('name','立面',e.name)+select('wallId','墙体',wallOptions(),e.wallId)+select('side','朝向',[['1','A 面'],['-1','B 面']],String(e.side))+num('depth','投影深度 / m',e.depth)+button('删除','remove-elevation',e.id),'保存')).join(''):empty)+`<p>在“出图”页勾选关键墙面立面，可预览和合并输出 PDF。</p>`;
 }
 function pointsPanel(){
  const f=floor();return `<h3>${esc(f.name)} · 水电点位</h3><p>墙面点位绑定墙体，定位距离从画墙起点 A 端计算。落地点位和灯具按平面坐标定位；吊顶安装填写距顶距离。点位用于交底，不自动设计电路容量或管线。</p>`+
   form('place-point',select('type','类型',Object.entries(D.POINT_TYPES),'socket')+select('surface','安装面',[['wall','墙面'],['floor','地面 / 自由位置'],['ceiling','顶面']],'wall')+num('height','离地高度 / 距顶距离（m）',.3,'min="0" max="20"'),'到画布放置点位')+
   D.serviceWarnings(f).map(w=>`<p class="delivery-error">${esc(w.message)}</p>`).join('')+
   (f.delivery.points.length?f.delivery.points.map(p=>form('edit-point',`<input type="hidden" name="id" value="${p.id}"><b>${esc(p.code)} · ${esc(D.POINT_TYPES[p.type])}</b>`+input('code','编号',p.code)+select('pointStatus','施工状态',Object.entries(R.STATUS_NAMES),R.constructionStatus(p))+input('device','设备 / 用途',p.device)+num('height',p.surface==='ceiling'?'距顶 / m':'离地 / m',p.height)+(p.surface==='wall'?select('wallId','安装墙',wallOptions(),p.wallId)+select('side','墙面',[['1','A 面'],['-1','B 面']],String(p.side))+num('offset','距墙起点 A / m',p.offset):num('x','X / m',p.x)+num('y','Y / m',p.y))+(p.type==='switch'?input('controls','控制灯具编号（逗号分隔）',(p.controls||[]).map(id=>f.delivery.points.find(q=>q.id===id)?.code||'?').join(',')):'')+input('note','说明',p.note)+button('删除','remove-point',p.id),'保存点位')).join(''):empty);
 }
 function quantitiesPanel(){
  const p=current(),f=floor(),q=Q.quantityRows(p),targets=[...f.rooms.map(r=>['room:'+r.id,r.name]),...wallOptions().map(([id,label])=>['wall:'+id,label])];
  return `<h3>饰面与工程量</h3><p>地面按墙体内边界扣除柱和楼梯洞口；墙面扣除门窗交集，不计洞口侧面。损耗和报价可编辑，人工修正必须填写原因。隐藏不等于拆除。</p>`+
   form('finish',select('target','房间 / 墙体',targets)+select('surface','饰面',[['floor','地面'],['ceiling','顶面'],['skirting','踢脚线'],['wall','墙面']],'floor')+select('side','墙面侧别',[['1','A 面'],['-1','B 面']],'1')+input('name','材料名称','涂料')+input('spec','规格')+input('work','施工项目','饰面施工')+num('start','沿墙起点 / m',0)+num('end','沿墙终点（空为墙末端）','')+num('bottom','分区底高 / m',0)+num('top','分区顶高（空为墙顶）',''),'添加饰面分区')+
   `<details><summary>已设饰面 ${f.delivery.finishes.length} 项 · 可修改材料与分区</summary>${f.delivery.finishes.map(o=>form('edit-finish',`<input type="hidden" name="id" value="${o.id}"><b>${esc(o.surface==='wall'?(o.side===1?'墙 A 面':'墙 B 面'):({floor:'地面',ceiling:'顶面',skirting:'踢脚线'})[o.surface])}</b>`+input('name','材料',o.name)+input('spec','规格',o.spec)+input('work','施工项目',o.work)+(o.surface==='wall'?num('start','沿墙起点 / m',o.start)+num('end','沿墙终点 / m',o.end??'')+num('bottom','分区底高 / m',o.bottom)+num('top','分区顶高 / m',o.top??''):'')+button('删除饰面','remove-finish',o.id),'保存饰面')).join('')||empty}</details>`+
   q.warnings.map(s=>`<p class="delivery-error">${esc(s)}</p>`).join('')+
   `<div class="delivery-actions"><strong>合计 ¥ ${q.total.toFixed(2)}</strong>${button('导出报价 CSV','csv')}</div><div class="delivery-table-wrap"><table class="quote-table"><thead><tr><th>房间 / 构件</th><th>材料 / 项目</th><th>原量 − 扣除 = 净量</th><th>损耗 %</th><th>材料单价</th><th>人工单价</th><th>修正净量（可空）</th><th>修正原因</th><th>计价量 / 合价</th><th></th></tr></thead><tbody>`+
   q.rows.map(r=>`<tr data-quote="${esc(r.key)}"><td>${esc(p.floors.find(f=>f.id===r.floorId)?.name)}<br>${esc(r.room)}</td><td>${esc(r.name)}<br><small>${esc(r.spec||'')} ${esc(r.category)}</small></td><td>${r.gross.toFixed(3)} − ${r.deduction.toFixed(3)} = ${r.net.toFixed(3)} ${r.unit}</td><td>${num('loss','',r.loss)}</td><td>${num('unitPrice','',r.unitPrice)}</td><td>${num('labor','',r.labor)}</td><td>${num('override','',r.override??'')}</td><td>${input('reason','',r.reason)}</td><td>${r.quantity.toFixed(3)} ${r.unit}<br>¥ ${r.amount.toFixed(2)}</td><td>${button('保存','quote-save')}${button('追溯','quote-trace',r.key)}</td></tr>`).join('')+`</tbody></table></div>${traceMarkup()}`+
   form('manual',input('name','人工补充项目','','text','required')+num('quantity','数量',1)+input('unit','单位','项')+num('unitPrice','材料单价',0)+num('labor','人工单价',0)+input('reason','计算依据','','text','required'),'添加人工项目')+
   p.delivery.manualRows.map(r=>`<p>${esc(r.name)} ${button('删除人工项目','remove-manual',r.id)}</p>`).join('');
 }
 function traceMarkup(){if(!trace)return '';const p=current(),f=R.phaseFloor(p,trace.floorId,trace.phase||'proposed');if(!f)return '';const finish=f.delivery?.finishes.find(x=>x.id===trace.finishId),wallFinish=finish?.surface==='wall',scene=wallFinish?elevationScene(p,f.id,{wallId:finish.targetId,side:finish.side,depth:.05,name:'饰面计量范围'}):planScene(p,f.id,trace.phase||'proposed');
  if(wallFinish){const g=Q.wallFinishGeometry(f,finish);if(!g.error)for(const poly of g.contours)scene.items.push({type:'poly',points:poly.map(([x,y])=>[finish.side===1?x:D.wallBasis(g.wall).length-x,(g.wall.height||f.height)-y]),color:'#d98259',fill:'none',width:.06});}
  for(const ref of trace.refs||[]){if(wallFinish)continue;const obj=ref.kind==='point'?f.delivery?.points.find(q=>q.id===ref.id):f[({wall:'walls',room:'rooms',opening:'openings',furniture:'furniture',solid:'solids',stair:'stairs'})[ref.kind]]?.find(q=>q.id===ref.id);if(!obj)continue;if(ref.kind==='room'){const g=Q.netRoomGeometry(p,f.id,obj.id);if(!g.error)for(const points of g.contours)scene.items.push({type:'poly',points,color:'#d98259',fill:'none',width:.065});continue;}const pts=ref.kind==='wall'?Q.wallFootprint(obj):ref.kind==='solid'?obj.poly:['furniture','stair'].includes(ref.kind)?D.furnitureCorners(obj).map(v=>[v.x,v.y]):null;if(pts)scene.items.push({type:'poly',points:pts,color:'#d98259',fill:'none',width:.065});else{const q=ref.kind==='point'?D.resolvePoint(f,obj):D.wallPoint(f.walls.find(w=>w.id===obj.wallId),obj.offset);if(!q.error)scene.items.push({type:'circle',x:q.x,y:q.y,r:.3,color:'#d98259',fill:'none',width:.065});}}
  const b=itemsBounds(scene.items);return `<section class="quantity-trace"><h3>${esc(trace.name||'构件定位')}</h3><p>${esc(trace.formula||'橙色轮廓为来源构件')}${trace.gross!=null?`；原量 ${trace.gross.toFixed(4)} − 扣除 ${trace.deduction.toFixed(4)} = 净量 ${trace.net.toFixed(4)} ${trace.unit}`:''}</p><svg viewBox="${b.x-.5} ${b.y-.5} ${b.w+1} ${b.h+1}" role="img" aria-label="清单来源定位">${itemsSVG(scene.items)}</svg></section>`;
 }
 function versionsPanel(){return `<p>方案和确认版保存在当前浏览器。确认版独立留档，不会随当前编辑覆盖；定期导出 JSON 备份。清理浏览器数据会删除本地留档。</p>`+
  form('fork',input('scheme','新方案名称','方案 B','text','required maxlength="60"'),'另存为新方案')+
  form('confirm',input('note','确认说明 / 客户 / 日期','','text','maxlength="160"'),'保存当前确认版')+
  `<div class="delivery-actions">${button('保存当前草稿到方案库','save-scheme')}${button('刷新方案库','refresh-library')}</div>`+
  (library.length?library.map(({key,project:p})=>`<article class="version-card"><div><b>${esc(p.name)} · ${esc(R.revisionLabel(p))}</b><p>${esc(p.delivery?.issueNote||'')} ${date(p.delivery?.issuedAt)}</p></div>${button('查看 / 导出','view-version',key)}${button(p.delivery?.status==='confirmed'?'从此版另存继续':'打开草稿','load-version',key)}</article>`).join(''):empty);}
 async function refreshLibrary(){library=await listLocalProjects();library.sort((a,b)=>(b.project.delivery?.issuedAt||'').localeCompare(a.project.delivery?.issuedAt||''));if(tab==='versions')draw();}
 function place(kind,values){placement={kind,values};firstAnchor=null;close();setMode('2d');setTool('delivery_'+kind);toast(kind==='dim'?'依次点击两个参照点，Esc 取消':kind==='point'?'点击安装位置；墙面点位请靠近墙线':'点击引注所指的位置');}
 async function submit(action,data){const f=floor(),p=current();
  if(action==='output'){output={paper:data.get('paper'),scale:n(data.get('scale')),phases:data.getAll('phase'),elevations:data.has('elevations'),points:data.has('points')};draw();return;}
  if(action==='source'){modify(()=>{p.delivery.source=data.get('source');p.delivery.sourceNote=data.get('sourceNote');});return;}
  if(action==='auto-dims'){modify(()=>D.autoDimensions(p,f.id,data.get('phase')));return;}
  if(action==='place-dim'){place('dim',{axis:data.get('axis'),offset:n(data.get('offset')) ,label:data.get('label')});return;}
  if(action==='place-note'){place('note',{text:data.get('text'),dx:n(data.get('dx')),dy:n(data.get('dy'))});return;}
  if(action==='place-point'){place('point',{type:data.get('type'),surface:data.get('surface'),height:n(data.get('height'))});return;}
  if(action==='edit-dim'){modify(()=>Object.assign(f.delivery.dimensions.find(d=>d.id===data.get('id')),{label:data.get('label'),axis:data.get('axis'),offset:n(data.get('offset'))}));return;}
  if(action==='edit-note'){modify(()=>Object.assign(f.delivery.notes.find(d=>d.id===data.get('id')),{text:data.get('text'),dx:n(data.get('dx')),dy:n(data.get('dy'))}));return;}
  if(action==='elevation'||action==='edit-elevation'){const values={wallId:data.get('wallId'),side:n(data.get('side')),depth:n(data.get('depth')),name:data.get('name')};modify(()=>action==='elevation'?D.addElevation(p,f.id,values.wallId,{...values,name:values.name||undefined}):Object.assign(f.delivery.elevations.find(q=>q.id===data.get('id')),values));return;}
  if(action==='edit-point'){modify(()=>{const q=f.delivery.points.find(q=>q.id===data.get('id')),code=data.get('code').trim();if(!code||f.delivery.points.some(o=>o.id!==q.id&&o.code===code))throw new Error('点位编号不能为空或重复');Object.assign(q,{code,device:data.get('device'),note:data.get('note'),height:n(data.get('height'))});q.renovation={...(q.renovation||{}),status:data.get('pointStatus')};if(q.surface==='wall')Object.assign(q,{wallId:data.get('wallId'),side:n(data.get('side')),offset:n(data.get('offset'))});else Object.assign(q,{x:n(data.get('x')),y:n(data.get('y'))});if(q.type==='switch')q.controls=String(data.get('controls')||'').split(/[,，、\s]+/).filter(Boolean).map(code=>{const light=f.delivery.points.find(o=>o.code===code&&o.type==='light');if(!light)throw new Error('未找到灯具 '+code);return light.id;});const loc=D.resolvePoint(f,q);if(loc.error)throw new Error(loc.error);});return;}
  if(action==='finish'){const [kind,targetId]=data.get('target').split(':');if((data.get('surface')==='wall')!==(kind==='wall'))throw new Error('墙面请选择墙体，地面 / 顶面 / 踢脚线请选择房间');modify(()=>Q.addFinish(p,f.id,{targetId,surface:data.get('surface'),side:n(data.get('side')),name:data.get('name'),spec:data.get('spec'),work:data.get('work'),start:n(data.get('start')),end:n(data.get('end'),null),bottom:n(data.get('bottom')),top:n(data.get('top'),null)}));return;}
  if(action==='edit-finish'){const values={name:data.get('name'),spec:data.get('spec'),work:data.get('work')};if(data.has('start'))Object.assign(values,{start:n(data.get('start')),end:n(data.get('end'),null),bottom:n(data.get('bottom')),top:n(data.get('top'),null)});modify(()=>Q.updateFinish(p,f.id,data.get('id'),values));return;}
  if(action==='manual'){modify(()=>p.delivery.manualRows.push({id:uid(),floorId:f.id,name:data.get('name'),quantity:n(data.get('quantity')),unit:data.get('unit'),unitPrice:n(data.get('unitPrice')),labor:n(data.get('labor')),reason:data.get('reason')}));return;}
  if(action==='fork'){await saveNow();await saveLocalScheme(p);const next=R.forkProject(p,data.get('scheme'));await saveLocalScheme(next);switchProject(next);await refreshLibrary();draw();status('已另存为新方案');return;}
  if(action==='confirm'){await saveNow();const records=await listLocalProjects(),snapshot=R.snapshotProject(p,{confirmed:true,label:data.get('note')});snapshot.delivery.revision=R.nextRevision(p,records.map(v=>v.project));await saveConfirmedRevision(snapshot);modify(()=>{p.delivery.revision=snapshot.delivery.revision+1;p.delivery.status='draft';p.delivery.basedOn=snapshot.delivery.issueId;});ctx.checkpoint();await saveNow();await refreshLibrary();status('确认版已独立留档；当前编辑进入下一版草稿');return;}
 }
 async function act(action,id,target){const p=current(),f=floor();
  if(action==='close'){close();return;}
  if(action==='baseline'){modify(()=>R.captureOriginal(p));return;}
  if(action==='phase3d'){previewPhase=id;viewer?.update(R.phaseProject(p,id),{...ui,floor:'all'},true);viewer?.renderer.render(viewer.scene,viewer.camera);if(viewer)phasePreviews[id]=viewer.renderer.domElement.toDataURL('image/png');draw();status('已生成三维对比视图');return;}
  if(action==='auto-dims'){modify(()=>D.autoDimensions(p,f.id));return;}
  if(action.startsWith('remove-')){const key=({dim:'dimensions',note:'notes',elevation:'elevations',point:'points',finish:'finishes'})[action.slice(7)];modify(()=>{if(action==='remove-manual')p.delivery.manualRows=p.delivery.manualRows.filter(o=>o.id!==id);else f.delivery[key]=f.delivery[key].filter(o=>o.id!==id);});return;}
  if(action==='entity-save'){const row=target.closest('tr'),ref={kind:row.dataset.kind,id:row.dataset.entity},statusValue=row.querySelector('[name=status]').value;modify(()=>{R.setConstructionStatus(p,f.id,[ref],statusValue);if(statusValue==='demolish'){ui.sel=null;ui.multi=[];}const wall=f.walls.find(w=>w.id===ref.id);if(wall){const evidence=row.querySelector('[name=evidence]').value.trim();Object.assign(wall.renovation,{structure:row.querySelector('[name=structure]').value,evidence,verified:!!evidence});}f.rooms=ctx.refreshRooms(f);});return;}
  if(action==='entity-trace'){const row=target.closest('tr');trace={floorId:f.id,refs:[{kind:row.dataset.kind,id}],phase:'changes'};draw();dialog.querySelector('.quantity-trace')?.scrollIntoView();return;}
  if(action==='quote-save'){const row=target.closest('tr');modify(()=>Q.setQuote(p,row.dataset.quote,Object.fromEntries(['loss','unitPrice','labor','override','reason'].map(k=>[k,k==='reason'?row.querySelector(`[name=${k}]`).value:n(row.querySelector(`[name=${k}]`).value,k==='override'?null:0)]))));return;}
  if(action==='quote-trace'){trace=Q.quantityRows(p).rows.find(r=>r.key===id);draw();dialog.querySelector('.quantity-trace')?.scrollIntoView();return;}
  if(action==='save-scheme'){await saveNow();await saveLocalScheme(p);await refreshLibrary();status('草稿已保存到方案库');return;}
  if(action==='refresh-library'){await refreshLibrary();return;}
  if(action==='view-version'){archive=clone(library.find(v=>v.key===id).project);tab='drawings';draw();return;}
  if(action==='clear-archive'){archive=null;draw();return;}
  if(action==='load-version'){await saveNow();await saveLocalScheme(p);const saved=validateProject(library.find(v=>v.key===id).project),next=saved.delivery?.status==='confirmed'?R.forkProject(saved,saved.delivery.scheme+' · 续改'):saved;switchProject(next);archive=null;await refreshLibrary();draw();status('已打开方案');return;}
  const snap=source().delivery?.status==='confirmed'?clone(source()):R.snapshotProject(source()),name=safeName(snap);
  if(action==='pdf'){status('正在生成 PDF…');const result=await exportDrawingPDF(snap,output);exported(name+'.pdf',new Blob([result.bytes],{type:'application/pdf'}),`已生成 ${result.sheets.length} 页 PDF`);return;}
  if(action==='csv'){exported(name+'-工程量.csv',new Blob([Q.quantitiesCSV(snap)],{type:'text/csv;charset=utf-8'}),'清单已生成');return;}
  if(action==='json'){exported(name+'.json',new Blob([JSON.stringify(snap,null,2)],{type:'application/json'}),'方案 JSON 已生成');return;}
  if(action==='html'){const model=R.phaseProject(snap);model.name=name;const [runtime,licenses]=await Promise.all(['walkthrough-runtime.js','walkthrough-licenses.txt'].map(async file=>{const r=await fetch(new URL(import.meta.env.BASE_URL+file,document.baseURI));if(!r.ok)throw new Error('漫游资源加载失败');return r.text();}));const html=createWalkthroughHTML(model,{runtime,licenses,floorId:f.id});exported(name+'-漫游.html',new Blob([html],{type:'text/html;charset=utf-8'}),'漫游网页已生成');return;}
 }
 dialog.addEventListener('submit',async e=>{e.preventDefault();if(busy)return;busy=true;try{await submit(e.target.dataset.form,new FormData(e.target));}catch(error){status(error.message,true);}finally{busy=false;}});
 dialog.addEventListener('click',async e=>{if(busy)return;const nav=e.target.closest('[data-tab]');if(nav){tab=nav.dataset.tab;trace=null;archive=null;draw();if(tab==='versions')refreshLibrary().catch(e=>status(e.message,true));return;}const b=e.target.closest('[data-action]');if(!b)return;busy=true;try{await act(b.dataset.action,b.dataset.id,b);}catch(error){status(error.message,true);}finally{busy=false;}});
 dialog.addEventListener('change',e=>{const form=e.target.closest('form');if(form?.dataset.form==='place-point'&&e.target.name==='type'){const type=e.target.value,surface=type==='light'?'ceiling':['drain','floorDrain'].includes(type)?'floor':'wall';form.elements.surface.value=surface;form.elements.height.value=surface==='wall'?(type==='switch'?1.3:.3):0;}if(form?.dataset.form==='finish'&&e.target.name==='target')form.elements.surface.value=e.target.value.startsWith('wall:')?'wall':'floor';});
 return {
  open,
  pointerDown(e,raw){
   if(ui.tool==='select'){const hit=e.target.closest('[data-point-id]');if(hit){open('points');return true;}}
   if(!ui.tool.startsWith('delivery_')||!placement)return false;
   const f=R.phaseFloor(current(),floor().id),anchor=D.nearestAnchor(f,raw,Math.max(.12,ctx.view.w/100));
   if(placement.kind==='dim'&&!firstAnchor){firstAnchor=anchor.ref;toast('已记录第一个参照，点击第二个参照');ctx.renderPlan();return true;}
   const ok=mutate(()=>{R.ensureDelivery(current());if(placement.kind==='dim')floor().delivery.dimensions.push(D.makeDimension(f,firstAnchor,anchor.ref,placement.values));else if(placement.kind==='note')D.addNote(current(),f.id,anchor.ref,placement.values.text,placement.values);else D.addServicePoint(current(),f.id,placement.values.type,raw,placement.values);R.validateDelivery(current());});
   if(ok){firstAnchor=null;placement=null;setTool('select');toast('已添加，打开“交付与报价”可调整参数');}return true;
  },
  planOverlay(px){const f=R.phaseFloor(current(),floor().id),items=annotationItems(f);for(const i of items){if(i.type==='text')i.size=11*px;else i.width=Math.max(i.width||0,px);}
   let s=`<g pointer-events="none">${itemsSVG(items)}</g>`;for(const p of f.delivery?.points||[]){const q=D.resolvePoint(f,p);if(!q.error)s+=`<circle data-point-id="${esc(p.id)}" cx="${q.x}" cy="${q.y}" r="${Math.max(.12,9*px)}" fill="transparent" pointer-events="all"><title>${esc(p.code)} ${esc(D.POINT_TYPES[p.type])} · 点击编辑</title></circle>`;}
   if(firstAnchor&&ui.tool==='delivery_dim'){const q=D.resolveAnchor(f,firstAnchor);if(!q.error)s+=`<circle cx="${q.x}" cy="${q.y}" r="${6*px}" fill="#d98259"/>`;}return s;
  },
  sync(){launch.title=R.revisionLabel(current());},
 };
}
