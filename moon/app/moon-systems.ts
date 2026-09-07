export type PowerMode='balanced'|'research'|'ecology';
export const powerProfiles={balanced:{name:'均衡运行',research:34,ecology:33,comms:33},research:{name:'科研优先',research:60,ecology:25,comms:15},ecology:{name:'生态优先',research:25,ecology:60,comms:15}} as const;
export function surveyDuration(mode:PowerMode){return mode==='research'?2:mode==='ecology'?5:4;}
export function launchAltitude(seconds:number){const t=Math.max(0,Math.min(20,seconds));return t<3?0:(t-3)**2*.65;}
