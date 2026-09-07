export const signalPoint={x:-95,z:-65};
export const researchPoint={x:-1.5,z:-16.2};
export const rockSamples=[
 {id:'basalt',name:'平原岩样',x:42,z:48,answer:'basalt',type:'玄武岩',clue:'深灰细粒，分布均匀，可见细小孔隙。',report:'细粒结构与气孔记录了熔岩冷却过程。该样本被归入基地的火山岩参考组。'},
 {id:'breccia',name:'喷出物岩样',x:-78,z:-48,answer:'breccia',type:'角砾岩',clue:'棱角状碎屑被细粒物质胶结，颗粒大小不一。',report:'碎屑与胶结结构提示撞击破碎、搬运及重新固结过程，已建立撞击样本档案。'},
 {id:'anorthosite',name:'高地岩样',x:90,z:-82,answer:'anorthosite',type:'斜长岩',clue:'浅灰色，晶粒较粗，以浅色矿物为主。',report:'浅色晶粒样本补充了高地区域的对照记录。三个采样点已构成第一组地质剖面。'},
] as const;
export type RockId=typeof rockSamples[number]['id'];
export type AdventureState={version:1;signal:'idle'|'active'|'recovered'|'decoded';samples:RockId[];studied:RockId[]};
export const freshAdventure=():AdventureState=>({version:1,signal:'idle',samples:[],studied:[]});
export function restoreAdventure(raw:unknown):AdventureState{const s=freshAdventure();if(!raw||typeof raw!=='object')return s;const r=raw as Partial<AdventureState>;if(r.version!==1)return s;if(['idle','active','recovered','decoded'].includes(r.signal??''))s.signal=r.signal!;s.samples=rockSamples.filter(v=>Array.isArray(r.samples)&&r.samples.includes(v.id)).map(v=>v.id);s.studied=s.samples.filter(id=>Array.isArray(r.studied)&&r.studied.includes(id));return s;}
export type AdventureAction={kind:'detect'}|{kind:'recover';frequency:number}|{kind:'collect';id:RockId}|{kind:'study';id:RockId;answer:string}|{kind:'decode'};
export function applyAdventure(s:AdventureState,a:AdventureAction,context:{x:number;z:number;onFoot:boolean;powered:boolean}){
 const near=(p:{x:number;z:number})=>context.onFoot&&Math.hypot(context.x-p.x,context.z-p.z)<3.2;
 if(a.kind==='detect'){if(s.signal!=='idle')return false;s.signal='active';return true;}
 if(a.kind==='recover'){if(s.signal!=='active'||!near(signalPoint)||!Number.isFinite(a.frequency)||Math.abs(a.frequency-142.4)>.051)return false;s.signal='recovered';return true;}
 if(a.kind==='collect'){const rock=rockSamples.find(r=>r.id===a.id);if(!rock||!near(rock)||s.samples.includes(a.id))return false;s.samples.push(a.id);return true;}
 if(!near(researchPoint)||!context.powered)return false;
 if(a.kind==='decode'){if(s.signal!=='recovered')return false;s.signal='decoded';return true;}
 const rock=rockSamples.find(r=>r.id===a.id);if(!rock||!s.samples.includes(a.id)||s.studied.includes(a.id)||a.answer!==rock.answer)return false;s.studied.push(a.id);return true;
}
export function signalReading(s:AdventureState,x:number,z:number){if(s.signal!=='active')return 0;const range=s.studied.length?220:150;return Math.max(0,Math.min(100,Math.round(100*(1-Math.hypot(x-signalPoint.x,z-signalPoint.z)/range))));}
