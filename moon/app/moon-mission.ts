export type MoonAction='status'|'collect'|'install'|'open'|'diagnose'|'parts'|'repair'|'sample'|'analyze'|'water'|'link'|'finish'|'overview'|'walk'|'recall'|'navigate_base'|'navigate_station'|'navigate_lander'|'navigate_crater'|'navigate_mission'|'power_balanced'|'power_research'|'power_ecology';
export type MoonState={carrying:boolean;powered:boolean;doorOpen:boolean;complete:boolean;diagnosed?:boolean;fuseCarrying?:boolean;solarRepaired?:boolean;sampleCollected?:boolean;sampleDelivered?:boolean;waterOnline?:boolean;commsOnline?:boolean};
export const initialState=():MoonState=>({carrying:false,powered:false,doorOpen:false,complete:false});
export const missions:{action:MoonAction;title:string;label:string;point:[number,number,number];report:string}[]=[
 {action:'collect',title:'前往补给箱，取出备用能源模块',label:'取出备用能源',point:[-7,1.4,1],report:'能源模块已收好。先给科研舱接上应急电源。'},
 {action:'install',title:'把能源模块装入供电站',label:'接入能源模块',point:[8,1.2,-1],report:'应急电源已接入，科研舱照明恢复。主太阳能回路仍然离线。'},
 {action:'open',title:'返回气闸，打开科研舱门',label:'打开科研舱气闸',point:[0,1.6,-5.2],report:'气闸正在开启。请进入科研舱，在尽头的科研台读取诊断。'},
 {action:'diagnose',title:'进入科研舱，读取系统诊断',label:'读取科研台诊断',point:[-1.5,1.3,-17.5],report:'诊断：太阳能保险模块损坏，水处理系统等待样本分析，通信尚未联机。维修柜里有备用零件。'},
 {action:'parts',title:'前往维修区，取出备用保险模块',label:'领取维修零件',point:[-11.9,1.3,8],report:'已领取保险模块。前往太阳能阵列外侧接线位置进行更换。'},
 {action:'repair',title:'更换太阳能阵列的保险模块',label:'更换模块并接通主电源',point:[10,1.2,-7],report:'保险模块已更换，主电源恢复。现在可以到钻探区采集水处理研究样本。'},
 {action:'sample',title:'前往钻探区，采集月壤样本',label:'封装钻探样本',point:[-22.7,1.2,15.8],report:'月壤样本已封装。带回科研台分析，取得水处理设备的启动参数。'},
 {action:'analyze',title:'返回科研台，分析月壤样本',label:'提交样本并分析',point:[-1.5,1.3,-17.5],report:'样本分析完成，水处理启动参数已生成。请到温室外侧恢复循环供水。'},
 {action:'water',title:'前往温室，恢复循环供水',label:'启动温室供水循环',point:[-9.3,1.2,-6],report:'温室供水已恢复，生态支持上线。接下来建立与地球的通信链路。'},
 {action:'link',title:'前往通信塔，建立地球链路',label:'校验并连接地球通信',point:[-10.8,1.4,-18],report:'地球链路已建立。基地恢复报告准备就绪，返回飞船提交任务。'},
 {action:'finish',title:'返回飞船，提交基地恢复报告',label:'提交任务报告',point:[22,1.3,22.2],report:'基地复苏任务完成。主电源、生态支持和地球通信已全部恢复，欢迎继续探索静海前哨。'}
];
export const missionStep=(s:MoonState)=>s.complete?11:s.commsOnline?11:s.waterOnline?10:s.sampleDelivered?9:s.sampleCollected?8:s.solarRepaired?7:s.fuseCarrying?6:s.diagnosed?5:s.doorOpen?4:s.powered?3:s.carrying?2:1;
export const currentMission=(s:MoonState)=>missions[missionStep(s)-1];
export const objective=(s:MoonState)=>s.complete?'基地已恢复运行 · 自由探索':currentMission(s).title;
export const missionTarget=(s:MoonState):[number,number,number]=>currentMission(s).point;
export const inventory=(s:MoonState)=>s.carrying?'备用能源模块':s.fuseCarrying?'备用保险模块':s.sampleCollected&&!s.sampleDelivered?'密封月壤样本':'背包为空';
export function missionAction(s:MoonState,a:MoonAction,distance:number):string{
 if(a==='status')return objective(s);
 if(s.complete)return '基地恢复任务已经完成，可以继续自由探索。';
 const task=currentMission(s);
 if(a!==task.action)return '请先完成当前任务：'+task.title;
 if(!Number.isFinite(distance)||distance<0||distance>3.2)return '距离太远，请先靠近目标。';
 switch(a){case 'collect':s.carrying=true;break;case 'install':s.carrying=false;s.powered=true;break;case 'open':s.doorOpen=true;break;case 'diagnose':s.diagnosed=true;break;case 'parts':s.fuseCarrying=true;break;case 'repair':s.fuseCarrying=false;s.solarRepaired=true;break;case 'sample':s.sampleCollected=true;break;case 'analyze':s.sampleDelivered=true;break;case 'water':s.waterOnline=true;break;case 'link':s.commsOnline=true;break;case 'finish':s.complete=true;break;}
 return task.report;
}
// Reconstruct only reachable states; ignore foreign versions and malformed progress.
export function restoreMission(raw:unknown):MoonState{
 const fresh=initialState();if(!raw||typeof raw!=='object')return fresh;
 const v=raw as {version?:unknown;step?:unknown};
 if(v.version!==1||!Number.isInteger(v.step)||Number(v.step)<0||Number(v.step)>missions.length)return fresh;
 for(let i=0;i<Number(v.step);i++)missionAction(fresh,missions[i].action,0);
 return fresh;
}
export const serializeMission=(s:MoonState)=>JSON.stringify({version:1,step:s.complete?missions.length:missionStep(s)-1});
