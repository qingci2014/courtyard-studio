export type InputMode = 'mouse' | 'hand';
export type Block = { x: number; z: number; y: number; color: number; cooldown: number };
export const TARGET = {x: 2.25, z: .8, half: .85};
export const LIMITS = {x:3.45,z:2.1};
export class Game {
 state: 'practice'|'running'|'paused'|'finished'='practice';
 mode:InputMode='mouse'; tracked=true; score=0; remaining=60; attempts=0;
 target={x:0,z:.2}; position={x:0,y:2.1,z:.2};
 blocks:Block[]=[]; held:number|null=null; grip=false; phase:'hover'|'down'|'lift'|'carry'|'drop'='hover';
 message='移动到方块上方，按住抓取'; onEvent:((event:'score'|'miss')=>void)|null=null;
 private action={x:0,z:0}; private needOpen=false; private messageTime=0;
 constructor(){this.reset();}
 reset(){this.state='practice';this.score=0;this.remaining=60;this.attempts=0;this.held=null;this.grip=false;this.needOpen=false;this.phase='hover';this.position={x:0,y:2.1,z:.2};this.target={x:0,z:.2};this.blocks=[{x:-2.4,z:-.7,y:.28,color:0x50ead1,cooldown:0},{x:-1.9,z:1.2,y:.28,color:0xffb657,cooldown:0},{x:-.3,z:-1,y:.28,color:0xad94ff,cooldown:0}];this.message='移动到方块上方，捏合或按住抓取';}
 start(){this.reset();this.state='running';this.message='挑战开始！将方块送入发光区域';this.messageTime=2;}
 pause(){if(this.state==='running'){this.state='paused';this.message='挑战已暂停，点击继续';}}
 resume(){if(this.state==='paused'){this.state='running';this.clearGrip();this.message='挑战继续';}}
 setTarget(x:number,z:number){this.target={x:Math.max(-LIMITS.x,Math.min(LIMITS.x,x)),z:Math.max(-LIMITS.z,Math.min(LIMITS.z,z))};}
 clearGrip(){this.grip=false;this.needOpen=true;}
 setGrip(closed:boolean){if(!closed)this.needOpen=false; if(this.state==='paused'||this.state==='finished')return; if(closed&&this.needOpen)return; const old=this.grip;this.grip=closed;if(closed&&!old&&this.phase==='hover'){this.phase='down';this.action={x:this.position.x,z:this.position.z};this.attempts++;}if(!closed&&old&&this.phase==='carry'){this.phase='drop';this.action={x:this.position.x,z:this.position.z};}}
 update(dt:number){if(this.state==='paused'||this.state==='finished')return;if(this.state==='running'){this.remaining=Math.max(0,this.remaining-dt);if(this.remaining===0){this.state='finished';this.grip=false;this.message='挑战完成';return;}}dt=Math.min(dt,.05);if(this.mode==='hand'&&!this.tracked)return;
 this.messageTime=Math.max(0,this.messageTime-dt);
 for(const block of this.blocks){if(block.cooldown>0){block.cooldown-=dt;if(block.cooldown<=0){const index=this.blocks.indexOf(block);const spawn=[[-2.4,-.7],[-1.9,1.2],[-.3,-1]][index]!;block.x=spawn[0]!;block.z=spawn[1]!;block.y=.28;}}}
 const moving=this.phase==='hover'||this.phase==='carry';const dest=moving?this.target:this.action;const a=1-Math.exp(-dt*10);this.position.x+=(dest.x-this.position.x)*a;this.position.z+=(dest.z-this.position.z)*a;
 const low=this.phase==='down'||this.phase==='drop';const height=low?.72:2.1;this.position.y+=(height-this.position.y)*(1-Math.exp(-dt*9));
 if(this.held!==null){const b=this.blocks[this.held]!;b.x=this.position.x;b.z=this.position.z;b.y=this.position.y-.44;}
 if(this.phase==='down'&&this.position.y<.77){let nearest=-1;let distance=.58;this.blocks.forEach((b,i)=>{const d=Math.hypot(b.x-this.position.x,b.z-this.position.z);if(b.cooldown<=0&&d<distance){nearest=i;distance=d;}});if(nearest>=0){this.held=nearest;this.message='抓取成功！移到发光区域后松开';this.messageTime=2;}else{this.message='没有抓到：让落点圆环对准方块';this.messageTime=2;this.onEvent?.('miss');}this.phase='lift';}
 if(this.phase==='lift'&&this.position.y>2.04){this.phase=this.held===null?'hover':'carry';if(this.phase==='carry'&&!this.grip){this.phase='drop';this.action={x:this.position.x,z:this.position.z};}}
 if(this.phase==='drop'&&this.position.y<.77){if(this.held!==null){const b=this.blocks[this.held]!;b.y=.28;const good=Math.abs(b.x-TARGET.x)<=TARGET.half-.27&&Math.abs(b.z-TARGET.z)<=TARGET.half-.27;if(good){this.score+=10;b.cooldown=.8;this.message='+10！准确投放';this.onEvent?.('score');}else{this.message='放置在桌面上了，再试一次';this.onEvent?.('miss');}this.messageTime=2;this.held=null;}this.phase='lift';}
 if(!this.messageTime&&moving)this.message=this.held!==null?'保持捏合搬运 → 在发光区域松开':this.mode==='hand'?'移动手掌瞄准 · 拇指食指捏合抓取':'移动鼠标瞄准 · 按住抓取 · 松开放置';
 }
}
