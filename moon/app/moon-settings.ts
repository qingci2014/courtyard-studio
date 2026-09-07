export type MoonSettings={volume:number;sensitivity:number;quality:'high'|'balanced';muted:boolean};
export const defaultSettings:MoonSettings={volume:.35,sensitivity:1,quality:'high',muted:false};
export function readSettings(raw:unknown):MoonSettings{
 const v=raw&&typeof raw==='object'?raw as Partial<MoonSettings>:{};
 const finite=(x:unknown,fallback:number,min:number,max:number)=>typeof x==='number'&&Number.isFinite(x)?Math.max(min,Math.min(max,x)):fallback;
 return {volume:finite(v.volume,.35,0,1),sensitivity:finite(v.sensitivity,1,.3,2.5),quality:v.quality==='balanced'?'balanced':'high',muted:v.muted===true};
}
