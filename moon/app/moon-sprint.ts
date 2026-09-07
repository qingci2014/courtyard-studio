/** Hold either Shift for two seconds to latch sprint; a fresh press cancels it. */
export class SprintLatch {
 locked=false;private held=new Set<string>();private elapsed=0;private cancelling=false;
 press(code:string){if(this.held.has(code))return;const first=this.held.size===0;this.held.add(code);if(first&&this.locked){this.locked=false;this.cancelling=true;}}
 release(code:string){this.held.delete(code);if(!this.held.size){this.elapsed=0;this.cancelling=false;}}
 update(dt:number,forward=false){if(!forward&&!this.locked){this.elapsed=0;return;}if(this.held.size&&!this.cancelling&&!this.locked){this.elapsed+=Math.max(0,Number.isFinite(dt)?dt:0);if(this.elapsed>=2)this.locked=true;}}
 get active(){return this.locked||this.held.size>0&&!this.cancelling;}
 reset(){this.locked=false;this.held.clear();this.elapsed=0;this.cancelling=false;}
}
