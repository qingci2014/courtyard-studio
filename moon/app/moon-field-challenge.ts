import type {FieldSiteId} from './moon-exploration';
export function solveField(id:FieldSiteId,answer:unknown):boolean{
 if(!Array.isArray(answer))return false;
 if(id==='sample-station')return answer.length===3&&answer[0]===true&&answer[1]===false&&answer[2]===true;
 if(id==='lost-lander')return answer.length===3&&answer.join(',')==='isolate,restore,extract';
 return id==='crater-watch'&&answer.length===2&&answer.every(v=>typeof v==='number'&&Number.isFinite(v))&&Math.abs(answer[0]-36)<=2&&Math.abs(answer[1]-12)<=1;
}
