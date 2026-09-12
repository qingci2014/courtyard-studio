import type { TaskSnapshot } from './production-task';
export type CommandDevice={id:string;title:string;kind:string};
export type Command={action:'start'|'pause'|'resume'|'reset'|'status'|'overview'|'focus'|'follow'|'ride';deviceId?:string};
export type CommandContext={task:TaskSnapshot;devices:CommandDevice[]};
export type Receipt={ok:boolean;message:string};
export interface CommandPort {context():CommandContext;controlTask(action:'start'|'pause'|'resume'|'reset'):void;overview():void;focus(id:string):void;followVehicle(id?:string):void;ride(id:string):void;}
const actions=['start','pause','resume','reset','status','overview','focus','follow','ride'];
export function validatePlan(value:unknown,devices:CommandDevice[]):Command[]{
 if(!Array.isArray(value)||value.length<1||value.length>4)throw Error('一次最多执行四个动作。');
 return value.map(item=>{if(!item||typeof item!=='object'||Object.keys(item).some(k=>!['action','deviceId'].includes(k))||!actions.includes(item.action))throw Error('收到不支持的动作，未执行。');
 const needsDevice=['focus','follow','ride'].includes(item.action);
 if(needsDevice){const d=devices.find(d=>d.id===item.deviceId);if(!d)throw Error('没有找到这台设备，未执行。');if(item.action!=='focus'&&d.kind!=='agv')throw Error('跟随和车载视角只适用于搬运车。');}
 else if(item.deviceId!==undefined)throw Error('该工单动作不接受设备编号。');
 return {action:item.action,...(needsDevice?{deviceId:item.deviceId}:{})} as Command;});
}
// Exact shortcuts only. This deliberately does not pretend to understand free-form language.
export function shortcut(text:string,devices:CommandDevice[]):Command[]|null{
 const s=text.trim().replace(/[。！!]+$/,'');
 const fixed:Record<string,Command[]>={'开始作业':[{action:'start'}],'暂停作业':[{action:'pause'}],'继续作业':[{action:'resume'}],'重置作业':[{action:'reset'}],'查看进度':[{action:'status'}],'回到全景':[{action:'overview'}],'开始作业并跟车':[{action:'start'},{action:'follow',deviceId:'AGV-03'}],'跟随搬运车':[{action:'follow',deviceId:'AGV-03'}]};
 if(fixed[s])return fixed[s];
 const match=s.match(/^(聚焦|跟随|车载视角)\s*(.+)$/);if(!match)return null;
 const d=devices.find(d=>d.id.toUpperCase()===match[2].trim().toUpperCase()||d.title===match[2].trim());
 if(!d)throw Error('没有找到这台设备，请使用设备索引中的名称或编号。');
 return validatePlan([{action:match[1]==='聚焦'?'focus':match[1]==='跟随'?'follow':'ride',deviceId:d.id}],devices);
}
export function executePlan(value:unknown,port:CommandPort):Receipt{
 let plan:Command[];try{plan=validatePlan(value,port.context().devices);}catch(e){return {ok:false,message:(e as Error).message};}
 // Preflight every action before any effect: invalid compound instructions never partly run.
 let status=port.context().task.status;
 for(const c of plan){if(c.action==='start'){if(status==='running'||status==='paused')return {ok:false,message:status==='paused'?'工单已暂停，请使用“继续作业”。':'工单正在运行，不会重复启动。'};status='running';}
 if(c.action==='pause'){if(status!=='running')return {ok:false,message:'当前没有运行中的工单，无需暂停。'};status='paused';}
 if(c.action==='resume'){if(status!=='paused')return {ok:false,message:'只有暂停中的工单可以继续。'};status='running';}if(c.action==='reset')status='idle';}
 const messages:string[]=[];
 for(const c of plan){const title=port.context().devices.find(d=>d.id===c.deviceId)?.title??c.deviceId;
 if(['start','pause','resume','reset'].includes(c.action)){port.controlTask(c.action as 'start'|'pause'|'resume'|'reset');messages.push(({start:'W-001 已启动：取料 → 装配 → 入库。',pause:'W-001 已暂停。',resume:'W-001 已继续。',reset:'工单、物料和车辆已复位。'} as Record<string,string>)[c.action]);}
 else if(c.action==='status'){const t=port.context().task;messages.push(`${t.title}，进度 ${t.progress}%，已用 ${t.elapsed} 秒。物料位于${t.location}。`);}
 else if(c.action==='overview'){port.overview();messages.push('已切换到车间全景。');}
 else if(c.action==='focus'){port.focus(c.deviceId!);messages.push(`镜头正在靠近${title}。`);}
 else if(c.action==='follow'){port.followVehicle(c.deviceId);messages.push(`镜头已跟随${title}。`);}
 else if(c.action==='ride'){port.ride(c.deviceId!);messages.push(`已进入${title}的车载视角。`);}}
 return {ok:true,message:messages.join('\n')};
}
