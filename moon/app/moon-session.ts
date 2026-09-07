import {EXPLORATION_LIMIT,fieldSites,type NavTarget} from './moon-exploration';
export type SessionPose={x:number;z:number;yaw:number;pitch:number};
export type MoonSession={version:1;player:SessionPose;rover:{x:number;z:number;yaw:number}|null;nav:NavTarget};
export function readSession(raw:unknown):MoonSession|null{
 if(!raw||typeof raw!=='object')return null;const data=raw as Partial<MoonSession>;
 const position=(p:unknown):p is SessionPose=>{if(!p||typeof p!=='object')return false;const v=p as SessionPose;return [v.x,v.z,v.yaw].every(Number.isFinite)&&Math.abs(v.x)<=EXPLORATION_LIMIT&&Math.abs(v.z)<=EXPLORATION_LIMIT&&Math.abs(v.yaw)<1e6;};
 if(data.version!==1||!position(data.player)||!Number.isFinite(data.player.pitch)||Math.abs(data.player.pitch)>1.35||data.rover!==null&&!position(data.rover))return null;
 const nav=data.nav==='base'||data.nav==='mission'||fieldSites.some(s=>s.id===data.nav)?data.nav!:'mission';
 return {version:1,player:{...data.player},rover:data.rover?{...data.rover}:null,nav};
}
