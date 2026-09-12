export type Point=[number,number,number];
export type Obstacle={id:string;x:number;z:number;hx:number;hz:number};
export const HOME:Point=[6,0,-.5],SOURCE_DOCK:Point=[15,0,-1.5],CELL_DOCK:Point=[-6,0,-2],FINISH_DOCK:Point=[15,0,3];
export const SOURCE:Point=[14.57,1.57,-3.12],FINISH:Point=[14.57,1.57,5.58],WORK:Point=[-4.45,1.45,-4.1],REST:Point=[-4.62,2,-4.1];
export const TITLES=['前往原料位','装载原料','运输至装配线','机械臂取件','执行装配','机械臂装车','运输至成品位','卸下成品','返回待命点'];
export function route(from:Point,to:Point,obstacles:Obstacle[]):Point[]{
 const step=.25,key=(x:number,z:number)=>`${x},${z}`,start=[Math.round(from[0]/step),Math.round(from[2]/step)],end=[Math.round(to[0]/step),Math.round(to[2]/step)];
 const free=(x:number,z:number)=>Math.abs(x*step)<17&&Math.abs(z*step)<11&&!obstacles.some(b=>Math.abs(x*step-b.x)<b.hx+1.08&&Math.abs(z*step-b.z)<b.hz+1.08);
 if(!free(...end as [number,number])||!free(...start as [number,number]))throw Error('车辆停靠点被占用');
 const queue=[start],previous=new Map<string,number[]|null>([[key(...start as [number,number]),null]]);
 for(let i=0;i<queue.length;i++){const [x,z]=queue[i];if(x===end[0]&&z===end[1])break;for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,nz=z+dz,k=key(nx,nz);if(free(nx,nz)&&!previous.has(k)){previous.set(k,[x,z]);queue.push([nx,nz]);}}}
 if(!previous.has(key(...end as [number,number])))throw Error('当前没有可用的运输路线');
 const raw:Point[]=[];let p:number[]|null=end;
 while(p){raw.unshift([p[0]*step,0,p[1]*step]);p=previous.get(key(...p as [number,number]))??null;}
 const result=[raw[0]];for(let i=1;i<raw.length-1;i++){const a=raw[i-1],b=raw[i],c=raw[i+1];if((b[0]-a[0])*(c[2]-b[2])!==(b[2]-a[2])*(c[0]-b[0]))result.push(b);}
 result.push(raw[raw.length-1]);return result;
}
const mix=(a:Point,b:Point,t:number):Point=>a.map((v,i)=>v+(b[i]-v)*t) as Point;
const smooth=(v:number)=>v*v*(3-2*v);
export function transfer(a:Point,b:Point,t:number,height:number):Point{
 // Raise clear of surrounding stock, translate, then lower vertically.
 const lift=Math.max(height,a[1],b[1]);
 if(t<.25)return mix(a,[a[0],lift,a[2]],smooth(t*4));
 if(t<.75)return mix([a[0],lift,a[2]],[b[0],lift,b[2]],smooth((t-.25)*2));
 return mix([b[0],lift,b[2]],b,smooth((t-.75)*4));
}
export type TaskSnapshot={status:string;stage:number;title:string;progress:number;elapsed:number;processed:boolean;location:string;activeDevice:string;waiting:boolean};
export class ProductionTask{
 status:'idle'|'running'|'paused'|'done'='idle';stage=0;stageTime=0;elapsed=0;processed=false;waiting=false;
 vehicle:Point=[...HOME];yaw=0;cargo:Point=[...SOURCE];tool:Point=[...REST];closed=false;
 readonly routes:Point[][];private waypoint=1;
 constructor(obstacles:Obstacle[]){const fixed=obstacles.filter(o=>o.id!=='AGV-03');this.routes=[route(HOME,SOURCE_DOCK,fixed),route(SOURCE_DOCK,CELL_DOCK,fixed),route(CELL_DOCK,FINISH_DOCK,fixed),route(FINISH_DOCK,HOME,fixed)];}
 reset(){this.status='idle';this.stage=0;this.stageTime=0;this.elapsed=0;this.processed=false;this.waiting=false;this.vehicle=[...HOME];this.yaw=0;this.cargo=[...SOURCE];this.tool=[...REST];this.closed=false;this.waypoint=1;}
 start(){if(this.status==='running'||this.status==='paused')return;this.reset();this.status='running';}
 pause(){if(this.status==='running')this.status='paused';}
 resume(){if(this.status==='paused')this.status='running';}
 get deck():Point{return [this.vehicle[0],1.02,this.vehicle[2]];}
 get driving(){return [0,2,6,8].includes(this.stage);}
 get routeIndex(){return this.stage===0?0:this.stage===2?1:this.stage===6?2:3;}
 tick(dt:number,blocked=false){
 if(this.status!=='running')return;dt=Math.min(.05,Math.max(0,dt));this.waiting=blocked&&this.driving;if(this.waiting)return;
 this.elapsed+=dt;this.stageTime+=dt;
 if(this.driving){const path=this.routes[this.routeIndex],target=path[this.waypoint];
  if(target){const dx=target[0]-this.vehicle[0],dz=target[2]-this.vehicle[2],desired=Math.atan2(-dz,dx);let delta=Math.atan2(Math.sin(desired-this.yaw),Math.cos(desired-this.yaw));this.yaw+=Math.sign(delta)*Math.min(Math.abs(delta),dt*2.5);
   if(Math.abs(delta)<.08){const distance=Math.hypot(dx,dz),move=Math.min(distance,dt*2.2);this.vehicle[0]+=dx/distance*move;this.vehicle[2]+=dz/distance*move;if(distance<=move+.00001)this.waypoint++;}
  }
  if(this.stage===2||this.stage===6)this.cargo=this.deck;
  if(this.waypoint>=path.length)this.advance();
 }else{
  const duration=this.stage===4?6:this.stage===3||this.stage===5?7:4,t=Math.min(1,this.stageTime/duration);
  const deck=this.deck;
  if(this.stage===1)this.cargo=transfer(SOURCE,deck,t,2);
  if(this.stage===3){if(t<.22){this.tool=mix(REST,[deck[0],deck[1]+.26,deck[2]],smooth(t/.22));this.closed=false;}else if(t<.8){this.cargo=transfer(deck,WORK,(t-.22)/.58,1.65);this.tool=[this.cargo[0],this.cargo[1]+.26,this.cargo[2]];this.closed=true;}else{this.cargo=[...WORK];this.tool=mix([WORK[0],WORK[1]+.26,WORK[2]],[WORK[0],WORK[1]+.3,WORK[2]],smooth((t-.8)/.2));this.closed=false;}}
  if(this.stage===4){this.cargo=[...WORK];this.tool=[WORK[0]+Math.sin(t*Math.PI*6)*.07,WORK[1]+.3+Math.abs(Math.sin(t*Math.PI*6))*.08,WORK[2]];this.closed=true;if(t>=1)this.processed=true;}
  if(this.stage===5){if(t<.18){this.tool=mix([WORK[0],WORK[1]+.3,WORK[2]],[WORK[0],WORK[1]+.26,WORK[2]],t/.18);this.closed=true;}else if(t<.8){this.cargo=transfer(WORK,deck,(t-.18)/.62,1.65);this.tool=[this.cargo[0],this.cargo[1]+.26,this.cargo[2]];this.closed=true;}else{this.cargo=deck;this.tool=mix([deck[0],deck[1]+.26,deck[2]],REST,smooth((t-.8)/.2));this.closed=false;}}
  if(this.stage===7)this.cargo=transfer(deck,FINISH,t,2);
  if(t>=1)this.advance();
 }
 }
 private advance(){this.stage++;this.stageTime=0;this.waypoint=1;if(this.stage>=TITLES.length){this.stage=TITLES.length-1;this.status='done';this.tool=[...REST];this.closed=false;}}
 snapshot():TaskSnapshot{return {status:this.status,stage:this.stage,title:this.status==='idle'?'等待开始':this.status==='done'?'工单完成':this.waiting?'等待行人让行':TITLES[this.stage],progress:this.status==='done'?100:Math.floor(this.stage/TITLES.length*100),elapsed:Math.floor(this.elapsed),processed:this.processed,location:this.stage<1?'原料缓存位':this.stage===1?'装载机构':this.stage===2?'AGV-03':this.stage===3||this.stage===5?'机械臂 / 工位':this.stage===4?'装配线 CV-02':this.stage===6?'AGV-03':'成品缓存位',activeDevice:this.stage>=3&&this.stage<=5?'RB-02':'AGV-03',waiting:this.waiting};}
}

