export const EXPLORATION_LIMIT=350;
export const fieldSites=[
 {id:'sample-station',name:'远端采样站',x:150,z:80,kind:'station',action:'下载地质采样记录',report:'采样站记录：浅层月壤与深层岩芯存在明显差异。已收录远端地质剖面，后续可用于选定新的钻探区。'},
 {id:'lost-lander',name:'废弃着陆器',x:-180,z:-120,kind:'lander',action:'读取着陆器飞行记录',report:'飞行记录恢复：这艘无人着陆器曾运送基地建设器材。最后一次自动着陆后通信中断，货舱仍保留了最初建设队的坐标标记。'},
 {id:'crater-watch',name:'陨石坑观测点',x:220,z:-170,kind:'crater',action:'记录陨石坑观测数据',report:'观测完成：撞击坑的坑壁和周围喷出物已完成标注。这份记录将帮助后续探测任务规划安全路线。'}
] as const;
export type FieldSiteId=typeof fieldSites[number]['id'];
export type NavTarget='mission'|'base'|FieldSiteId;
export const fieldRoutes:[number,number][][]=[[[0,30],[40,60],[150,80]],[[-30,0],[-60,-45],[-180,-120]],[[28,28],[65,-35],[220,-170]]];
export function segmentDistance(x:number,z:number,a:number[],b:number[]){const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));return {distance:Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz),t};}
export const validDiscoveries=(raw:unknown):FieldSiteId[]=>Array.isArray(raw)?fieldSites.filter(s=>raw.includes(s.id)).map(s=>s.id):[];
