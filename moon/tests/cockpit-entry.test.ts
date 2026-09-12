import {expect,it} from 'vitest';import{atCockpitLadder}from'../app/moon-cockpit-entry';
it('offers boarding at the ladder approach facing the ship',()=>{expect(atCockpitLadder(22,1.78,24,0,-1)).toBe(true);expect(atCockpitLadder(23,1.78,23,-.7,-.7)).toBe(true);});
it('does not offer boarding behind the ship, far away, above the cabin or facing away',()=>{for(const p of [[22,1.78,16,0,1],[25,1.78,23,-1,0],[22,1.78,28,0,-1],[22,6,23,0,-1],[22,1.78,24,0,1],[NaN,1.78,24,0,-1]])expect(atCockpitLadder(...p as [number,number,number,number,number])).toBe(false);});
