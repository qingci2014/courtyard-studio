import {describe,it,expect} from 'vitest';
import {SprintLatch} from '../../moon/app/moon-sprint';
describe('sprint hold lock',()=>{
 it('requires forward movement for arming',()=>{const s=new SprintLatch();s.press('ShiftLeft');s.update(3,false);expect(s.locked).toBe(false);s.update(1,true);s.update(.1,false);s.update(1.1,true);expect(s.locked).toBe(false);s.update(.9,true);expect(s.locked).toBe(true);s.release('ShiftLeft');s.update(1,false);expect(s.locked).toBe(true);});
 it('short hold only sprints while held',()=>{const s=new SprintLatch();s.press('ShiftLeft');s.update(1.9,true);expect(s.active).toBe(true);expect(s.locked).toBe(false);s.release('ShiftLeft');expect(s.active).toBe(false);});
 it('two seconds persists after release',()=>{const s=new SprintLatch();s.press('ShiftRight');s.update(2,true);s.release('ShiftRight');expect(s.active).toBe(true);});
 it('a fresh press cancels without relatching until released',()=>{const s=new SprintLatch();s.press('ShiftLeft');s.update(2,true);s.press('ShiftLeft');expect(s.locked).toBe(true);s.release('ShiftLeft');s.press('ShiftLeft');s.update(4,true);expect(s.active).toBe(false);s.release('ShiftLeft');s.press('ShiftLeft');s.update(2,true);expect(s.locked).toBe(true);});
 it('combines both shifts without double-counting time',()=>{const s=new SprintLatch();s.press('ShiftLeft');s.update(1,true);s.press('ShiftRight');s.release('ShiftLeft');s.update(1,true);expect(s.locked).toBe(true);});
 it('reset on pause or leaving walking clears latch and timer',()=>{const s=new SprintLatch();s.press('ShiftLeft');s.update(2,true);s.reset();s.update(5,true);expect(s.active).toBe(false);s.press('ShiftRight');s.update(1,true);expect(s.locked).toBe(false);});
});
