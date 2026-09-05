import {describe,it,expect} from 'vitest';
import {GestureFilter} from '../gesture-filter';
describe('Palm stability and deliberate pinch transitions',()=>{
 it('locks the pre-pinch aim through finger movement, then allows carrying',()=>{
  const f=new GestureFilter();f.update(0,0,1,100);
  expect(f.update(.25,.25,.2,165)).toEqual({x:0,z:0,pinch:false});
  expect(f.update(.4,.4,.2,295)).toEqual({x:0,z:0,pinch:true});
  expect(f.update(.7,.7,.2,500).x).toBeGreaterThan(.4);
 });
 it('ignores a short false opening but accepts a sustained release',()=>{
  const f=new GestureFilter();f.update(0,0,.2,100);expect(f.update(0,0,.2,200).pinch).toBe(true);
  expect(f.update(0,0,.9,400).pinch).toBe(true);expect(f.update(0,0,.2,500).pinch).toBe(true);
  expect(f.update(0,0,.9,600).pinch).toBe(true);expect(f.update(0,0,.9,810).pinch).toBe(false);
 });
 it('suppresses tiny stationary jitter without preventing a deliberate movement',()=>{
  const f=new GestureFilter();f.update(0,0,1,100);expect(f.update(.01,-.01,1,165).x).toBe(0);
  const moved=f.update(1,0,1,230);expect(moved.x).toBeGreaterThan(.5);expect(moved.x).toBeLessThan(1);
 });
 it('retains a held gesture across a tracking gap and resets for a new camera session',()=>{
  const f=new GestureFilter();f.update(0,0,.2,100);f.update(0,0,.2,200);f.suspend();
  expect(f.update(1,1,.2,1500).pinch).toBe(true);f.reset();expect(f.update(0,0,1,1600).pinch).toBe(false);
 });
});
