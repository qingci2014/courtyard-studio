import {EXPLORATION_LIMIT} from './moon-exploration';
export type RoverPose={x:number;z:number;yaw:number;speed:number};
export type RoverObstacle={x:number;z:number;hx:number;hz:number};
export type RoverInput={throttle:number;steer:number;brake:boolean};
export type Surface=(x:number,z:number)=>number;
// Separating axes for the vehicle footprint against each static rectangle.
export function roverFits(x:number,z:number,yaw:number,obstacles:RoverObstacle[],surface:Surface):boolean{
 const hx=1.9,hz=2.2,c=Math.cos(yaw),s=Math.sin(yaw),ac=Math.abs(c),as=Math.abs(s);
 const rx=ac*hx+as*hz,rz=as*hx+ac*hz;
 if(Math.abs(x)+rx>EXPLORATION_LIMIT||Math.abs(z)+rz>EXPLORATION_LIMIT)return false;
 for(const o of obstacles){const dx=o.x-x,dz=o.z-z;if(Math.abs(dx)>=rx+o.hx||Math.abs(dz)>=rz+o.hz)continue;if(Math.abs(c*dx-s*dz)>=hx+ac*o.hx+as*o.hz||Math.abs(s*dx+c*dz)>=hz+as*o.hx+ac*o.hz)continue;return false;}
 const heights=[[-hx,-hz],[hx,-hz],[-hx,hz],[hx,hz]].map(([a,b])=>surface(x+c*a+s*b,z-s*a+c*b));
 return heights.every(Number.isFinite)&&Math.max(...heights)-Math.min(...heights)<1.8;
}
export function advanceRover(p:RoverPose,input:RoverInput,elapsed:number,obstacles:RoverObstacle[],surface:Surface){
 const dt=Math.max(0,Math.min(.04,elapsed)),throttle=Math.max(-1,Math.min(1,input.throttle)),steer=Math.max(-1,Math.min(1,input.steer));
 const target=input.brake?0:throttle*(throttle<0?2.2:6),rate=input.brake?12:throttle?3.5:2.5;
 let speed=p.speed+Math.max(-rate*dt,Math.min(rate*dt,target-p.speed));
 // Differential wheel steering remains available at rest; the brake holds both sides.
 const steeringRate=.75+.4*Math.min(1,Math.abs(speed)/2);
 const turn=input.brake?0:steer*dt*steeringRate*(speed<-.05?-1:1),yaw=p.yaw+turn,travel=speed*dt;
 const x=p.x+Math.sin(yaw)*travel,z=p.z+Math.cos(yaw)*travel;
 if(!roverFits(x,z,yaw,obstacles,surface))return {pose:{...p,speed:0},travel:0,turn:0,blocked:true};
 return {pose:{x,z,yaw:Math.atan2(Math.sin(yaw),Math.cos(yaw)),speed},travel,turn,blocked:false};
}
