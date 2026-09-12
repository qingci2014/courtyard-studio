import {readSession,type SessionPose} from './moon-session';

export const COCKPIT_RETURN_KEY='selene-cockpit-return-v1';
export type CockpitReturnPose=SessionPose&{y:number;fov:number};

function readPose(raw:unknown):CockpitReturnPose|null{
 if(!raw||typeof raw!=='object')return null;
 const data=raw as {version?:number;pose?:CockpitReturnPose};
 const pose=data.pose;
 if(data.version!==1||!pose||!Number.isFinite(pose.y)||pose.y<-.1||pose.y>200||!Number.isFinite(pose.fov)||pose.fov<30||pose.fov>110)return null;
 const session=readSession({version:1,player:pose,rover:null,nav:'mission'});
 return session?{x:pose.x,y:pose.y,z:pose.z,yaw:pose.yaw,pitch:pose.pitch,fov:pose.fov}:null;
}

/** Keep the boarding pose in this tab, independently of the shared autosave. */
export function rememberCockpitReturn(pose:CockpitReturnPose){
 try{sessionStorage.setItem(COCKPIT_RETURN_KEY,JSON.stringify({version:1,pose}));}catch{}
}

/** Consume once after the base has loaded; refreshing the cockpit keeps it. */
export function takeCockpitReturn():CockpitReturnPose|null{
 try{
  const raw=sessionStorage.getItem(COCKPIT_RETURN_KEY);
  sessionStorage.removeItem(COCKPIT_RETURN_KEY);
  return raw?readPose(JSON.parse(raw)):null;
 }catch{return null;}
}
