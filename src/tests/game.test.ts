import {describe,it,expect} from 'vitest';
import {Game,TARGET} from '../game';
const tick=(g:Game,seconds=2)=>{for(let t=0;t<seconds;t+=.02)g.update(.02);};
function pickup(g:Game){g.setTarget(-2.4,-.7);tick(g);g.setGrip(true);tick(g);expect(g.held).toBe(0);}
describe('Air grab interaction state',()=>{
 it('picks up, transports and scores one delivery, then respawns',()=>{const g=new Game();pickup(g);g.setTarget(TARGET.x,TARGET.z);tick(g);g.setGrip(false);tick(g);expect(g.score).toBe(10);expect(g.held).toBeNull();expect(g.blocks[0]!.x).toBe(-2.4);tick(g,5);expect(g.score).toBe(10);});
 it('does not score outside the delivery zone',()=>{const g=new Game();pickup(g);g.setTarget(0,1);tick(g);g.setGrip(false);tick(g);expect(g.score).toBe(0);expect(g.blocks[0]!.z).toBeCloseTo(1);});
 it('freezes all gameplay and countdown when paused',()=>{const g=new Game();g.start();pickup(g);g.pause();const time=g.remaining;const x=g.position.x;g.setTarget(3,2);tick(g,4);expect(g.remaining).toBe(time);expect(g.position.x).toBe(x);g.resume();tick(g);expect(g.remaining).toBeLessThan(time);});
 it('stops scoring at timeout and resets all round state',()=>{const g=new Game();g.start();pickup(g);g.remaining=.01;g.update(.1);expect(g.state).toBe('finished');g.setGrip(false);tick(g);expect(g.score).toBe(0);g.start();expect(g.held).toBeNull();expect(g.attempts).toBe(0);expect(g.remaining).toBe(60);expect(g.score).toBe(0);});
 it('holds a carried block on tracking loss instead of dropping it',()=>{const g=new Game();pickup(g);g.mode='hand';g.tracked=false;g.setTarget(3,2);tick(g);expect(g.held).toBe(0);expect(g.position.x).toBeCloseTo(-2.4);});
 it('does not grab repeatedly while pinch stays closed',()=>{const g=new Game();g.setGrip(true);tick(g);g.setGrip(true);tick(g);expect(g.attempts).toBe(1);});
 it('clamps the workspace and requires opening after input reset',()=>{const g=new Game();g.setTarget(99,-99);expect(g.target).toEqual({x:3.45,z:-2.1});g.clearGrip();g.setGrip(true);expect(g.attempts).toBe(0);g.setGrip(false);g.setGrip(true);expect(g.attempts).toBe(1);});
});
