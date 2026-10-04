import {area,bounds,pointIn,projection,roomLabelPoint} from './model.js';
import {furnitureMetrics} from './assets.js';

const localPoint=(p,o)=>{const a=(o.rot||0)*Math.PI/180,x=p.x-o.x,y=p.y-o.y;return{x:x*Math.cos(a)+y*Math.sin(a),y:-x*Math.sin(a)+y*Math.cos(a)};};
export function walkBlocked(p,f,{doorStates=new Map(),includeHidden=false,furniture=true}={}){
 for(const w of f.walls){if(w.hidden&&!includeHidden)continue;const q=projection(p,w);if(q.distance>w.thickness/2+.19)continue;const door=f.openings.find(o=>o.wallId===w.id&&o.type==='door'&&(doorStates.get(o.id)??true)&&Math.abs(q.offset-o.offset)<o.width/2-.2);if(!door)return true;}
 if(furniture)for(const o of f.furniture){if(o.hidden&&!includeHidden)continue;const q=localPoint(p,o);if(Math.abs(q.x)>=o.w/2+.16||Math.abs(q.y)>=o.d/2+.16)continue;const metrics=furnitureMetrics(o),base=o.z??metrics.base;if(base<1.6&&base+metrics.height>.2)return true;}
 for(const o of f.solids||[]){if(o.hidden&&!includeHidden||o.base>=1.6||o.base+o.height<=.2)continue;const inSolid=q=>pointIn(q,o.poly)&&!(o.holes||[]).some(hole=>pointIn(q,hole));if([[0,0],[.18,0],[-.18,0],[0,.18],[0,-.18]].some(([x,y])=>inSolid({x:p.x+x,y:p.y+y})))return true;}
 return false;
}
export function findWalkStart(f,roomId,blocked){
 const rooms=roomId?f.rooms.filter(r=>r.id===roomId):[...f.rooms].sort((a,b)=>area(b.poly)-area(a.poly));if(roomId&&!rooms.length)return null;
 const onStairs=p=>f.stairs.some(st=>{const q=localPoint(p,st);return Math.abs(q.x)<st.w/2+.12&&Math.abs(q.y)<st.d/2+.12;});
 const safe=p=>!blocked(p)&&!onStairs(p)&&(!rooms.length||rooms.some(r=>pointIn(p,r.poly)));
 for(const r of rooms){const p=roomLabelPoint(r.poly);if(safe(p))return p;}
 const regions=rooms.length?rooms.map(r=>{const xs=r.poly.map(p=>p[0]),ys=r.poly.map(p=>p[1]);return{x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};}):[bounds(f)];
 for(const b of regions){const center={x:b.x+b.w/2,y:b.y+b.h/2};if(safe(center))return center;const step=Math.max(.3,Math.max(b.w,b.h)/90);let best=null,distance=Infinity;for(let x=b.x+.23;x<b.x+b.w-.15;x+=step)for(let y=b.y+.23;y<b.y+b.h-.15;y+=step){const p={x,y},d=Math.hypot(x-center.x,y-center.y);if(d<distance&&safe(p)){best=p;distance=d;}}if(best)return best;}
 return null;
}
