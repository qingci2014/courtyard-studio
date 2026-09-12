import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import * as T from 'three';
import {MoonWorld} from '../app/moon-world';
import {COCKPIT_RETURN_KEY,rememberCockpitReturn,takeCockpitReturn} from '../app/moon-cockpit-return';

const pose={x:22.42,y:1.78,z:23.16,yaw:.26,pitch:-.18,fov:83};
let storage:Map<string,string>;
beforeEach(()=>{
 storage=new Map();
 vi.stubGlobal('sessionStorage',{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value),removeItem:(key:string)=>storage.delete(key)});
 vi.stubGlobal('document',{pointerLockElement:null});
 vi.stubGlobal('window',{location:{assign:vi.fn()}});
});
afterEach(()=>vi.unstubAllGlobals());

function world(){
 const camera=new T.PerspectiveCamera(64);
 return Object.assign(Object.create(MoonWorld.prototype),{
  camera,assetsReady:true,driving:false,controlsPaused:false,mode:'overview',yaw:0,pitch:0,
  keys:new Set(['KeyW']),sprint:{reset:vi.fn()},orbit:{enabled:true},renderer:{domElement:{focus:vi.fn()}},
  walkPose:{position:new T.Vector3(0,1.78,13),yaw:1,pitch:.1},
  canEnterCockpit:()=>true,free:()=>true,exitTelescope:vi.fn(),persistSession:vi.fn(),notify:vi.fn(),lock:vi.fn(),
 });
}

describe('cockpit round trip',()=>{
 it('returns to the exact boarding pose in walking mode, even when the general save has moved',()=>{
  const departure=world();departure.mode='walk';departure.camera.position.set(pose.x,pose.y,pose.z);
  departure.yaw=pose.yaw;departure.pitch=pose.pitch;departure.camera.fov=pose.fov;
  departure.enterCockpit();
  expect(window.location.assign).toHaveBeenCalledWith('/moon/cockpit/');
  expect(storage.has(COCKPIT_RETURN_KEY)).toBe(true);
  const returned=world();returned.controlsPaused=true;returned.resumeFromCockpit();
  expect(returned.camera.position.toArray()).toEqual([pose.x,pose.y,pose.z]);
  expect([returned.yaw,returned.pitch,returned.camera.fov]).toEqual([pose.yaw,pose.pitch,pose.fov]);
  expect(returned.camera.rotation.y).toBe(pose.yaw);expect(returned.camera.rotation.x).toBe(pose.pitch);
  expect(returned.mode).toBe('walk');expect(returned.orbit.enabled).toBe(false);expect(returned.controlsPaused).toBe(false);
  expect(returned.keys.size).toBe(0);expect(returned.lock).not.toHaveBeenCalled();
  expect(returned.renderer.domElement.focus).toHaveBeenCalledWith({preventScroll:true});
  expect(returned.persistSession).toHaveBeenCalled();expect(takeCockpitReturn()).toBeNull();
 });
 it('supports players already inside an older cockpit using the restored autosave',()=>{
  const returned=world();returned.walkPose={position:new T.Vector3(21.8,1.78,23.8),yaw:-.2,pitch:.12};
  returned.resumeFromCockpit();
  expect(returned.camera.position.toArray()).toEqual([21.8,1.78,23.8]);expect(returned.yaw).toBe(-.2);expect(returned.mode).toBe('walk');
 });
 it('keeps the departure record until the scene is ready',()=>{
  rememberCockpitReturn(pose);const returned=world();returned.assetsReady=false;returned.resumeFromCockpit();
  expect(storage.has(COCKPIT_RETURN_KEY)).toBe(true);expect(returned.mode).toBe('overview');
 });
 it('falls back safely when the recorded spot is now obstructed',()=>{
  rememberCockpitReturn(pose);const returned=world();returned.free=()=>false;returned.resumeFromCockpit();
  expect(returned.camera.position.toArray()).toEqual([0,1.78,13]);expect(returned.mode).toBe('walk');
 });
 it('rejects corrupt or invalid records without breaking the return button',()=>{
  for(const value of ['invalid',JSON.stringify({version:2,pose}),JSON.stringify({version:1,pose:{...pose,x:999}}),JSON.stringify({version:1,pose:{...pose,pitch:9}}),JSON.stringify({version:1,pose:{...pose,fov:0}})]){
   storage.set(COCKPIT_RETURN_KEY,value);expect(takeCockpitReturn()).toBeNull();expect(storage.has(COCKPIT_RETURN_KEY)).toBe(false);
  }
 });
 it('does not fail navigation when browser storage is unavailable',()=>{
  vi.stubGlobal('sessionStorage',{getItem(){throw Error('unavailable');},setItem(){throw Error('unavailable');}});
  expect(()=>rememberCockpitReturn(pose)).not.toThrow();expect(takeCockpitReturn()).toBeNull();
  const returned=world();expect(()=>returned.resumeFromCockpit()).not.toThrow();expect(returned.mode).toBe('walk');
 });
 it('still requests mouse control for a normal manual start',()=>{const started=world();started.walk();expect(started.lock).toHaveBeenCalledOnce();});
});
