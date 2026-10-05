// Construction intent is independent of visibility and edit locks.
export const ENTITY_LISTS=['walls','openings','rooms','furniture','stairs','solids'];
export const PHASES={original:'原始图',demolition:'拆除图',proposed:'新建 / 布置图',changes:'拆改对照'};
export const STATUS_NAMES={existing:'现状保留',demolish:'拟拆除',new:'拟新建'};
export const PHASE_COLORS={existing:'#69747c',demolish:'#c65345',new:'#3877aa'};
const clone=v=>structuredClone(v);
const id=()=>crypto.randomUUID();
const finite=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
export const constructionStatus=o=>o?.renovation?.status||'existing';
export const phaseVisible=(o,phase='proposed')=>phase==='original'||phase==='demolition'?constructionStatus(o)!=='new':phase==='proposed'?constructionStatus(o)!=='demolish':true;
export function ensureDelivery(project){
 project.delivery??={schema:1,scheme:'方案 A',revision:1,source:'estimated',sourceNote:'',quotes:{},manualRows:[]};
 project.delivery.quotes??={};project.delivery.manualRows??=[];
 for(const f of project.floors){f.delivery??={dimensions:[],notes:[],points:[],elevations:[],finishes:[]};for(const key of ['dimensions','notes','points','elevations','finishes'])f.delivery[key]??=[];}
 return project.delivery;
}
export function revisionLabel(project){const d=project.delivery;return `${d?.scheme||'方案 A'} · R${String(d?.revision||1).padStart(3,'0')}${d?.status==='confirmed'?' 确认版':' 草稿'}`;}
export function nextRevision(project,records=[]){return Math.max(project.delivery?.revision||1,...records.filter(p=>p.id===project.id&&p.delivery?.status==='confirmed').map(p=>p.delivery.revision+1));}
export function assignCodes(project){
 const prefixes={walls:'W',openings:'O',rooms:'R',furniture:'F',stairs:'S',solids:'C'};
 for(const f of project.floors)for(const key of ENTITY_LISTS){const used=new Set((f[key]||[]).map(o=>o.code).filter(Boolean));let n=1;for(const o of f[key]||[]){if(o.code)continue;while(used.has(prefixes[key]+String(n).padStart(3,'0')))n++;o.code=prefixes[key]+String(n++).padStart(3,'0');used.add(o.code);}}
}
export function captureOriginal(project){
 const d=ensureDelivery(project);if(d.baseline)throw new Error('原始户型已留档，不能覆盖；新建项目可另建原始户型。');
 assignCodes(project);d.baseline={capturedAt:new Date().toISOString(),floors:project.floors.map(f=>{
  const out={id:f.id,name:f.name,height:f.height};for(const key of ENTITY_LISTS)out[key]=clone((f[key]||[]).filter(o=>constructionStatus(o)!=='new')).map(o=>{delete o.hidden;delete o.locked;o.renovation={...(o.renovation||{}),status:'existing'};return o;});out.delivery={dimensions:[],notes:[],elevations:[],finishes:clone(f.delivery?.finishes||[]),points:clone((f.delivery?.points||[]).filter(p=>constructionStatus(p)==='existing'))};return out;
 })};d.workflow='design';return d.baseline;
}
export function phaseFloor(project,floorId,phase='proposed'){
 const current=project.floors.find(f=>f.id===floorId),baseline=project.delivery?.baseline?.floors.find(f=>f.id===floorId);
 if(['original','demolition'].includes(phase)&&project.delivery?.baseline&&!baseline)return null;
 if(!current){if(!baseline||!['original','demolition','changes'].includes(phase))return null;const f=clone(baseline);if(phase!=='original'){for(const key of ENTITY_LISTS)for(const o of f[key])o.renovation={...(o.renovation||{}),status:'demolish'};for(const p of f.delivery?.points||[])p.renovation={...(p.renovation||{}),status:'demolish'};}return f;}
 const saved=phase==='original'&&baseline,f=saved?{...current,...clone(saved),delivery:{...current.delivery,finishes:clone(saved.delivery?.finishes||[]),points:clone(saved.delivery?.points||[])}}:{...current};
 for(const key of ENTITY_LISTS)f[key]=(f[key]||[]).filter(o=>saved||phaseVisible(o,phase));
 if(phase==='demolition'&&baseline)f.rooms=clone(baseline.rooms);
 const walls=new Set(f.walls.map(w=>w.id));f.openings=f.openings.filter(o=>walls.has(o.wallId));
 if(!saved&&phase!=='changes')f.openings=f.openings.filter(o=>phaseVisible(o,phase));
 if(f.delivery)f.delivery={...f.delivery,points:(f.delivery.points||[]).filter(p=>phaseVisible(p,phase))};
 return f;
}
export function phaseProject(project,phase='proposed'){const ids=phase==='proposed'?project.floors.map(f=>f.id):[...new Set([...(project.delivery?.baseline?.floors||[]).map(f=>f.id),...project.floors.map(f=>f.id)])];return {...project,floors:ids.map(id=>phaseFloor(project,id,phase)).filter(Boolean)};}
export function setConstructionStatus(project,floorId,refs,status){
 if(!STATUS_NAMES[status])throw new Error('无效的施工状态');ensureDelivery(project);
 const f=project.floors.find(f=>f.id===floorId),map={wall:'walls',opening:'openings',room:'rooms',furniture:'furniture',stair:'stairs',solid:'solids'};
 if(!f)throw new Error('楼层不存在');
 const targets=refs.map(r=>f[map[r.kind]]?.find(o=>o.id===r.id));if(!targets.length||targets.some(o=>!o))throw new Error('请先选择构件');
 if(targets.some(o=>o.locked))throw new Error('请先解锁选中构件');
 for(const o of targets){o.renovation={...(o.renovation||{}),status};if(f.walls.includes(o))for(const opening of f.openings.filter(q=>q.wallId===o.id)){if(opening.locked)throw new Error('墙上的门窗已锁定');opening.renovation={...(opening.renovation||{}),status};}}
}
const geometry=(o,key)=>JSON.stringify(key==='walls'?[o.a,o.b,o.thickness,o.height]:[o.wallId,o.offset,o.width,o.height,o.sill,o.type]);
// After the baseline is captured, deleting an existing object records demolition.
// Moving/resizing an existing wall/opening keeps the original as a demolition item.
export function reconcileRenovation(before,after){
 if(before.id!==after.id||!before.delivery?.baseline||!after.delivery?.baseline)return;
 for(const f of after.floors){const prev=before.floors.find(q=>q.id===f.id);if(!prev){for(const key of ENTITY_LISTS)for(const o of f[key]||[])o.renovation={...(o.renovation||{}),status:'new'};continue;}
  for(const key of ENTITY_LISTS){const previous=new Map((prev[key]||[]).map(o=>[o.id,o]));for(const o of f[key]||[]){if(!previous.has(o.id)&&constructionStatus(o)!=='demolish')o.renovation={...(o.renovation||{}),status:'new'};}
   for(const old of prev[key]||[]){const current=(f[key]||[]).find(o=>o.id===old.id);
    if(!current&&constructionStatus(old)==='existing'){const removed=clone(old);removed.renovation={...(old.renovation||{}),status:'demolish'};f[key].push(removed);continue;}
    if(!current||!['walls','openings'].includes(key)||constructionStatus(old)!=='existing'||constructionStatus(current)!=='existing'||geometry(old,key)===geometry(current,key))continue;
    const historic=clone(old);historic.id=id();historic.code=(old.code||'原构件')+'-拆';historic.renovation={...(old.renovation||{}),status:'demolish',replacedBy:current.id};
    current.renovation={...(current.renovation||{}),status:'new',replaces:historic.id};current.inferred=false;f[key].push(historic);
    if(key==='walls')for(const opening of prev.openings.filter(o=>o.wallId===old.id)){
     const prior=clone(opening);prior.id=id();prior.wallId=historic.id;prior.code=(opening.code||'原洞口')+'-拆';prior.renovation={...(opening.renovation||{}),status:'demolish'};f.openings.push(prior);
     const next=f.openings.find(o=>o.id===opening.id);if(next)next.renovation={...(next.renovation||{}),status:'new',replaces:prior.id};
    }
   }
  }
 }
 assignCodes(after);
}
export function snapshotProject(project,{confirmed=false,label}={}){
 const p=clone(project),d=ensureDelivery(p);assignCodes(p);d.status=confirmed?'confirmed':'draft';d.issuedAt=new Date().toISOString();d.issueId=id();if(label)d.issueNote=String(label).slice(0,160);return p;
}
export function forkProject(project,name){
 const p=clone(project),d=ensureDelivery(p);d.familyId=d.familyId||project.id;d.basedOn=d.issueId||project.delivery?.basedOn||'';p.id=id();d.scheme=String(name||'方案副本').trim().slice(0,60);d.revision=1;d.status='draft';delete d.issueId;delete d.issuedAt;return p;
}
export function remapFloorDelivery(f,ids){
 if(!f.delivery)return;
 for(const key of ['dimensions','notes','points','elevations','finishes'])for(const o of f.delivery[key]){const old=o.id;o.id=id();ids.set(old,o.id);}
 const anchor=a=>{if(a?.id&&ids.has(a.id))a.id=ids.get(a.id);};
 for(const d of f.delivery.dimensions){anchor(d.a);anchor(d.b);}
 for(const n of f.delivery.notes)anchor(n.anchor);
 for(const p of f.delivery.points){if(p.wallId)p.wallId=ids.get(p.wallId)||p.wallId;p.controls=(p.controls||[]).map(v=>ids.get(v)||v);}
 for(const e of f.delivery.elevations)e.wallId=ids.get(e.wallId)||e.wallId;
 for(const t of f.delivery.finishes)t.targetId=ids.get(t.targetId)||t.targetId;
}
export function scaleFloorDelivery(f,origin,ratio){
 if(!f.delivery)return;const point=p=>{p.x=origin.x+(p.x-origin.x)*ratio;p.y=origin.y+(p.y-origin.y)*ratio;};
 const anchor=a=>{if(a.kind==='free')point(a);if(a.offset!=null)a.offset*=ratio;if(a.finish!=null)a.finish*=ratio;};
 for(const d of f.delivery.dimensions){anchor(d.a);anchor(d.b);d.offset*=ratio;if(d.fallback){point(d.fallback.a);point(d.fallback.b);}}
 for(const n of f.delivery.notes){anchor(n.anchor);n.dx*=ratio;n.dy*=ratio;}
 for(const p of f.delivery.points){if(p.surface==='wall')p.offset*=ratio;else point(p);}
 for(const e of f.delivery.elevations)e.depth*=ratio;
 for(const t of f.delivery.finishes){t.start*=ratio;if(t.end!=null)t.end*=ratio;}
}
export function constructionWarnings(project){
 const issues=[];for(const f of phaseProject(project,'changes').floors)for(const w of f.walls){if(constructionStatus(w)==='demolish'&&(!w.renovation?.verified||w.renovation?.structure==='unknown'||!w.renovation?.structure||w.renovation?.structure==='bearing'))issues.push(`${f.name} ${w.code||'墙体'}：${w.renovation?.structure==='bearing'?'已标为承重墙，拆改须专业核实':'拟拆改，结构性质或依据待复核'}`);}
 return issues;
}
export function validateDelivery(project){
 if(project.delivery==null&&!project.floors.some(f=>f.delivery))return project;
 const d=project.delivery;if(!d||d.schema!==1||!Number.isInteger(d.revision)||d.revision<1||d.revision>99999||!['estimated','calibrated','measured'].includes(d.source))throw new Error('交付资料版本或尺寸依据无效');
 d.scheme=String(d.scheme||'方案 A').slice(0,60);d.sourceNote=String(d.sourceNote||'').slice(0,1000);
 if(d.source==='measured'&&!d.sourceNote.trim())throw new Error('现场复核需填写测量依据');
 if(d.baseline&&(!Array.isArray(d.baseline.floors)||d.baseline.floors.length>10))throw new Error('原始户型留档无效');
 if(d.quotes!=null&&(typeof d.quotes!=='object'||Array.isArray(d.quotes)||Object.keys(d.quotes).length>20000))throw new Error('报价数据无效');
 for(const q of Object.values(d.quotes||{})){
  if(!q||typeof q!=='object'||Array.isArray(q))throw new Error('报价数据无效');
  for(const [k,max] of [['loss',500],['unitPrice',1e8],['labor',1e8]])if(q[k]!=null&&!finite(q[k],0,max))throw new Error('损耗或单价无效');
  if(q.override!=null&&(!finite(q.override,0,1e9)||!String(q.reason||'').trim()))throw new Error('修正数量需为非负数，并填写修正原因');
 }
 if(d.manualRows!=null&&(!Array.isArray(d.manualRows)||d.manualRows.length>2000))throw new Error('人工项目数据无效');
 for(const row of d.manualRows||[])if(!row.id||!finite(row.quantity,0,1e9)||!finite(row.unitPrice||0,0,1e8)||!finite(row.labor||0,0,1e8))throw new Error('人工项目数量或价格无效');
 for(const f of project.floors){
  for(const key of ENTITY_LISTS)for(const o of f[key]||[]){if(o.renovation&&!STATUS_NAMES[o.renovation.status])throw new Error('构件施工状态无效');if(o.renovation?.structure&&!['unknown','bearing','nonbearing'].includes(o.renovation.structure))throw new Error('结构属性无效');}
  if(!f.delivery)continue;
  for(const key of ['dimensions','notes','points','elevations','finishes'])if(!Array.isArray(f.delivery[key])||f.delivery[key].length>3000)throw new Error('楼层交付资料过多或不完整');
  const seen=new Set();for(const key of ['dimensions','notes','points','elevations','finishes'])for(const o of f.delivery[key]){if(typeof o.id!=='string'||!o.id||seen.has(o.id))throw new Error('交付资料编号重复或无效');seen.add(o.id);}
  const anchor=a=>a&&typeof a==='object'&&(a.kind==='free'?finite(a.x,-500,500)&&finite(a.y,-500,500):typeof a.id==='string'&&['wall','opening','furniture','solid','point'].includes(a.kind))&&(a.offset==null||finite(a.offset,0,1000))&&(a.finish==null||finite(a.finish,0,10))&&(a.side==null||[-1,0,1].includes(a.side));
  for(const x of f.delivery.dimensions)if(!anchor(x.a)||!anchor(x.b)||!['aligned','horizontal','vertical'].includes(x.axis)||!finite(x.offset,-100,100))throw new Error('尺寸标注无效');
  for(const x of f.delivery.notes)if(!anchor(x.anchor)||typeof x.text!=='string'||x.text.length>1000||!finite(x.dx,-100,100)||!finite(x.dy,-100,100))throw new Error('文字引注无效');
  const pointCodes=new Set();for(const x of f.delivery.points){if(!['socket','switch','light','water','drain','floorDrain','ac','heater','data'].includes(x.type)||!finite(x.height,0,20)||!['wall','floor','ceiling'].includes(x.surface)||(x.surface==='wall'?(typeof x.wallId!=='string'||!finite(x.offset,0,1000)||![1,-1].includes(x.side)):(!finite(x.x,-500,500)||!finite(x.y,-500,500)))||x.controls!=null&&(!Array.isArray(x.controls)||x.controls.length>3000||x.controls.some(v=>typeof v!=='string')))throw new Error('水电点位定位无效');if(typeof x.code!=='string'||!x.code.trim()||x.code.length>40||pointCodes.has(x.code))throw new Error('点位编号不能为空或重复');pointCodes.add(x.code);if(x.renovation&&!STATUS_NAMES[x.renovation.status])throw new Error('点位施工状态无效');}
  for(const x of f.delivery.elevations)if(typeof x.wallId!=='string'||![1,-1].includes(x.side)||!finite(x.depth,.05,30))throw new Error('立面范围无效');
  for(const x of f.delivery.finishes){if(!['floor','ceiling','wall','skirting'].includes(x.surface)||!x.targetId)throw new Error('饰面目标无效');if(x.surface==='wall'&&(![1,-1].includes(x.side)||!finite(x.start,0,1000)||x.end!=null&&!finite(x.end,0,1000)||!finite(x.bottom,0,20)||x.top!=null&&!finite(x.top,0,20)))throw new Error('墙面分区范围无效');}
 }
 return project;
}
