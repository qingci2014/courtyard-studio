import React,{type ReactNode} from 'react';
import {Check,ChevronRight,Circle,Target} from 'lucide-react';
import {inventory,missionStep,missions,type MoonState} from './moon-mission';

export function MissionJournal({state,saveStatus,onTrack,children}:{state:MoonState;saveStatus:string;onTrack:()=>void;children?:ReactNode}){
 const completed=state.complete?missions.length:missionStep(state)-1;
 const current=state.complete?null:missions[completed];
 const pending=missions.slice(completed+(current?1:0));
 return <div className="moon-mission-journal">
  <header className="moon-mission-summary"><div><small>主线任务</small><h2>基地复苏</h2></div><div className="moon-mission-progress"><span><b>{completed}</b> / {missions.length} 已完成</span><progress aria-label="基地复苏完成进度" value={completed} max={missions.length}/></div></header>
  {current?<section className="moon-current-mission" aria-label="当前任务" aria-current="step"><div className="moon-current-marker"><Target size={23}/><span>当前任务</span><b>{String(completed+1).padStart(2,'0')}</b></div><h3>{current.title}</h3><div className="moon-current-bottom"><span><kbd>E</kbd> 靠近目标后{current.label}</span><button onClick={onTrack}>追踪这个目标 <ChevronRight size={17}/></button></div></section>:<section className="moon-current-mission is-complete" aria-label="主线已完成"><div className="moon-current-marker"><Check size={23}/><span>主线已完成</span></div><h3>静海前哨已恢复运行</h3><p>主电源、生态支持和地球通信已上线，可以继续自由探索。</p></section>}
  <div className="moon-mission-groups">
   <section className="moon-pending-missions" aria-label="未完成任务"><header><Circle size={15}/><h3>未完成</h3><span>{pending.length}</span></header>{pending.length?<ol>{pending.map((m,i)=><li key={m.action}><span className="moon-mission-number">{String(completed+2+i).padStart(2,'0')}</span><span>{m.title}</span><small>待进行</small></li>)}</ol>:<p className="moon-mission-empty">{current?'完成当前任务后，主线即可收官。':'全部任务均已完成。'}</p>}</section>
   <section className="moon-completed-missions" aria-label="已完成任务"><header><Check size={17}/><h3>已完成</h3><span>{completed}</span></header>{completed?<ol>{missions.slice(0,completed).map((m,i)=><li key={m.action}><details><summary><Check size={15}/><span className="moon-mission-number">{String(i+1).padStart(2,'0')}</span><span>{m.title}</span><ChevronRight className="moon-report-toggle" size={14}/></summary><p>{m.report}</p></details></li>)}</ol>:<p className="moon-mission-empty">你的第一项任务正在等待完成。</p>}</section>
  </div>
  <footer className="moon-journal-footer"><div className="moon-mission-systems"><span>主电源 <b>{state.solarRepaired?'在线':state.powered?'应急供电':'离线'}</b></span><span>生态支持 <b>{state.waterOnline?'在线':'离线'}</b></span><span>地球通信 <b>{state.commsOnline?'在线':'离线'}</b></span><span>携带物 <b>{inventory(state)}</b></span></div><p>{saveStatus}</p>{children}</footer>
 </div>;
}
