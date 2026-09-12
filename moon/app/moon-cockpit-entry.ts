/** Base-model ladder foot is at (22, 21.7); restrict the prompt to its approach side. */
export function atCockpitLadder(x:number,y:number,z:number,forwardX:number,forwardZ:number){
 if(![x,y,z,forwardX,forwardZ].every(Number.isFinite)||Math.abs(x-22)>1.7||z<21.65||z>24.7||y<.8||y>3.2)return false;
 const dx=22-x,dz=21.7-z;const distance=Math.hypot(dx,dz);
 return distance<.3||(dx*forwardX+dz*forwardZ)/distance>.25;
}
