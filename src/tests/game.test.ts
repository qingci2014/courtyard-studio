import {describe,it,expect} from 'vitest';
import {Game,TARGET} from '../game';
const tick=(g:Game,seconds=2)=>{for(let t=0;t<seconds;t+=.02)g.update(.02);};
function pickup(g:Game){g.setTarget(-2.4,-.7);tick(g);g.setGrip(true);tick(g);expect(g.held).toBe(0);}
describe('Air grab interaction state',()=>{
 it('slides an overlapping release to a random clear neighbour with tilt and bounce',()=>{
  const landings=new Set<string>();
  for(const random of [0,.25,.5,.75,.99]){
   const g=new Game(()=>random);pickup(g);
   const support={...g.blocks[1]!};g.setTarget(support.x,support.z);tick(g);g.setGrip(false);
   for(let i=0;i<100&&!g.blocks[0]!.fall;i++)g.update(.01);
   const b=g.blocks[0]!;expect(b.fall).toBeDefined();expect(b.y).toBeGreaterThan(.79);expect(g.held).toBeNull();
   tick(g,.2);expect(Math.abs(b.tiltX!)+Math.abs(b.tiltZ!)).toBeGreaterThan(.1);
   g.setTarget(b.x,b.z);expect(g.aimIndex).not.toBe(0);
   tick(g,1.2);expect(b.fall).toBeUndefined();expect(b.y).toBe(.28);expect(b.tiltX).toBe(0);expect(b.tiltZ).toBe(0);
   expect(g.blocks[1]).toEqual(support);expect(g.score).toBe(0);
   expect(Math.abs(b.x)).toBeLessThanOrEqual(3.05);expect(Math.abs(b.z)).toBeLessThanOrEqual(1.8);
   g.blocks.slice(1).forEach(other=>expect(Math.hypot(b.x-other.x,b.z-other.z)).toBeGreaterThanOrEqual(.85));
   landings.add(`${b.x},${b.z}`);
  }
  expect(landings.size).toBeGreaterThan(2);
 });
 it('pauses a fall and clears it when restarting',()=>{
  const g=new Game();g.start();pickup(g);g.setTarget(-1.9,1.2);tick(g);g.setGrip(false);
  for(let i=0;i<100&&!g.blocks[0]!.fall;i++)g.update(.01);
  expect(g.blocks[0]!.fall).toBeDefined();g.pause();const before=JSON.stringify(g.blocks);tick(g);expect(JSON.stringify(g.blocks)).toBe(before);
  g.reset();expect(g.blocks.every(b=>!b.fall)).toBe(true);
 });
 it('snaps a nearby highlighted block and catches it even before the claw arrives',()=>{const g=new Game();g.setTarget(-1.7,-.7);expect(g.aimIndex).toBe(0);g.setGrip(true);g.setTarget(3,-2);tick(g);expect(g.held).toBe(0);expect(g.attempts).toBe(1);});
 it('does not grab a distant block when clicking empty space',()=>{const g=new Game();g.setTarget(3,-2);expect(g.aimIndex).toBeNull();g.setGrip(true);tick(g);expect(g.held).toBeNull();});
 it('keeps a target through small jitter but allows intentional switching',()=>{const g=new Game();g.blocks[0]!.x=-.4;g.blocks[0]!.z=0;g.blocks[1]!.x=.4;g.blocks[1]!.z=0;g.setTarget(-.15,0);expect(g.aimIndex).toBe(0);g.setTarget(.05,0);expect(g.aimIndex).toBe(0);g.setTarget(.3,0);expect(g.aimIndex).toBe(1);g.setTarget(3,-2);expect(g.aimIndex).toBeNull();});
 it('does not highlight or acquire a cooling-down block',()=>{const g=new Game();g.blocks[0]!.cooldown=10;g.setTarget(-2.4,-.7);expect(g.aimIndex).toBeNull();g.setGrip(true);tick(g);expect(g.held).toBeNull();});
 it('assists an edge release into the goal and keeps the committed release point',()=>{const g=new Game();pickup(g);g.setTarget(TARGET.x+.8,TARGET.z);expect(g.dropReady).toBe(true);g.setGrip(false);g.setTarget(-3,2);tick(g);expect(g.score).toBe(10);});
 it('picks up, transports and scores one delivery, then respawns elsewhere',()=>{const g=new Game();pickup(g);g.setTarget(TARGET.x,TARGET.z);tick(g);g.setGrip(false);tick(g);expect(g.score).toBe(10);expect(g.held).toBeNull();expect(Math.hypot(g.blocks[0]!.x+2.4,g.blocks[0]!.z+.7)).toBeGreaterThanOrEqual(.8);tick(g,5);expect(g.score).toBe(10);});
 it('repeated random spawns stay reachable and separated from the goal, base and other blocks',()=>{
  let seed=7;const g=new Game(()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;});
  const positions=new Set<string>();
  for(let round=0;round<80;round++){
   const old=g.blocks.map(b=>({x:b.x,z:b.z}));
   g.blocks.forEach(b=>{b.cooldown=.01;});g.update(.02);
   g.blocks.forEach((b,i)=>{
    expect(b.cooldown).toBe(0);expect(Math.abs(b.x)).toBeLessThanOrEqual(3);expect(Math.abs(b.z)).toBeLessThanOrEqual(1.8);
    expect(Math.hypot(b.x,b.z+2.25)).toBeGreaterThanOrEqual(1.3);
    expect(Math.abs(b.x-TARGET.x)>=TARGET.half+.5||Math.abs(b.z-TARGET.z)>=TARGET.half+.5).toBe(true);
    expect(Math.hypot(b.x-old[i]!.x,b.z-old[i]!.z)).toBeGreaterThanOrEqual(.8);
    g.blocks.forEach((other,j)=>{if(i!==j)expect(Math.hypot(b.x-other.x,b.z-other.z)).toBeGreaterThanOrEqual(1.05);});
    positions.add(`${b.x},${b.z}`);
   });
  }
  expect(positions.size).toBeGreaterThan(20);
 });
 it('does not score outside the delivery zone',()=>{const g=new Game();pickup(g);g.setTarget(0,1);tick(g);g.setGrip(false);tick(g);expect(g.score).toBe(0);expect(g.blocks[0]!.z).toBeCloseTo(1);});
 it('freezes all gameplay and countdown when paused',()=>{const g=new Game();g.start();pickup(g);g.pause();const time=g.remaining;const x=g.position.x;g.setTarget(3,2);tick(g,4);expect(g.remaining).toBe(time);expect(g.position.x).toBe(x);g.resume();tick(g);expect(g.remaining).toBeLessThan(time);});
 it('stops scoring at timeout and resets all round state',()=>{const g=new Game();g.start();pickup(g);g.remaining=.01;g.update(.1);expect(g.state).toBe('finished');g.setGrip(false);tick(g);expect(g.score).toBe(0);g.start();expect(g.held).toBeNull();expect(g.attempts).toBe(0);expect(g.remaining).toBe(60);expect(g.score).toBe(0);});
 it('holds a carried block on tracking loss instead of dropping it',()=>{const g=new Game();pickup(g);g.mode='hand';g.tracked=false;g.setTarget(3,2);tick(g);expect(g.held).toBe(0);expect(g.position.x).toBeCloseTo(-2.4);});
 it('does not grab repeatedly while pinch stays closed',()=>{const g=new Game();g.setGrip(true);tick(g);g.setGrip(true);tick(g);expect(g.attempts).toBe(1);});
 it('clamps the workspace and requires opening after input reset',()=>{const g=new Game();g.setTarget(99,-99);expect(g.target).toEqual({x:3.45,z:-2.1});g.clearGrip();g.setGrip(true);expect(g.attempts).toBe(0);g.setGrip(false);g.setGrip(true);expect(g.attempts).toBe(1);});
});
