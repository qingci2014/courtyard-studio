import {describe,it,expect} from 'vitest';
import * as T from 'three';
import {prepareBedroomPassage,replaceBedroomInterior} from './moon-bedroom';
import layout from '../public/content/bedroom-layout.json';
import baseLayout from '../public/content/layout.json';

const mesh=(name:string,x:number,z:number)=>{const o=new T.Mesh(new T.BoxGeometry(.5,.5,.5),new T.MeshStandardMaterial());o.name=name;o.position.set(x,1,z);return o;};
describe('bedroom replacement and safe circulation',()=>{
 it('balances corridor finishes without darkening the shared exterior shell material',()=>{
  const base=new T.Group(),shared=new T.MeshStandardMaterial({color:0xffffff,metalness:.8,roughness:.2});
  const wall=mesh('Passage_wall.001',1.48,-20.4),floor=mesh('Passage_floor',0,-20.4),hull=mesh('Research_shell',0,-12);
  for(const o of [wall,floor,hull]){o.material=shared;base.add(o);}
  prepareBedroomPassage(base);
  expect(hull.material).toBe(shared);expect(shared.color.getHex()).toBe(0xffffff);expect(shared.metalness).toBe(.8);
  expect(wall.material).not.toBe(shared);expect(floor.material).not.toBe(shared);
  expect(floor.material.roughness).toBeGreaterThan(.75);expect(wall.material.envMapIntensity).toBeLessThan(.25);
 });
 it('replaces GLTFLoader-sanitised furniture names while retaining the hull and workroom',()=>{
  const base=new T.Group(),bed=mesh('Sleep_berth_frame',-2.9,-25),chair=mesh('Cabin_chair_back_shell',1.91,-23),shell=mesh('Living_front',-2.72,-21.9),research=mesh('Cabin_desk',1,-15),ship=mesh('Cabin_docking_hatch',16,13);
  base.add(bed,chair,shell,research,ship);replaceBedroomInterior(base,[]);
  expect(bed.parent).toBeNull();expect(chair.parent).toBeNull();expect(base.children).toEqual([shell,research,ship]);
 });
 it('locates cloth with baked world-coordinate vertices rather than an origin at zero',()=>{
  const base=new T.Group(),cloth=mesh('Realism_draped_duvet',0,0);cloth.position.set(0,0,0);cloth.geometry.translate(-2.9,1,-25);base.add(cloth);
  replaceBedroomInterior(base,[]);expect(cloth.parent).toBeNull();
 });
 it('keeps interactive models and furniture colliders outside the bedroom',()=>{
  const base=new T.Group(),interactable=mesh('Cabin_terminal',0,-24);interactable.userData.moonId='terminal';base.add(interactable);
  const old=[{id:'berth',x:-2.9,z:-25,hx:.9,hz:1.3},{id:'table',x:0,z:-12,hx:1,hz:.5},{id:'living-back',x:0,z:-32.1,hx:4,hz:.12}];
  const result=replaceBedroomInterior(base,old);expect(interactable.parent).toBe(base);expect(result).not.toContain(old[0]);expect(result).toContain(old[1]);expect(result).toContain(old[2]);
 });
 it('leaves the complete bedroom companion path clear with its real .38 m clearance',()=>{
  const route=[[.65,-24],[-.65,-25.5],[.65,-27.5],[-.65,-28.6],[.65,-24],[.65,-20.5]];
  for(let j=1;j<route.length;j++)for(let i=0;i<=100;i++){
   const f=i/100,x=route[j-1][0]*(1-f)+route[j][0]*f,z=route[j-1][1]*(1-f)+route[j][1]*f;
   expect(layout.colliders.some(o=>Math.abs(x-o.x)<o.hx+.38&&Math.abs(z-o.z)<o.hz+.38),`Patrol obstruction at ${x},${z}`).toBe(false);
  }
 });
 it('keeps the actual outer workroom, passage and bedroom continuously walkable',()=>{
  const obstacles=replaceBedroomInterior(new T.Group(),baseLayout.colliders);
  // Follow the aisle beside the research desk, then the existing doorway.
  const route=[[.65,-16.5],[.65,-18.5],[0,-20],[0,-30.25]];
  for(let j=1;j<route.length;j++)for(let i=0;i<=210;i++)for(const side of [-.25,0,.25]){
   const f=i/210,x=route[j-1][0]*(1-f)+route[j][0]*f+side,z=route[j-1][1]*(1-f)+route[j][1]*f;
   const blocker=obstacles.find(o=>Math.abs(x-o.x)<o.hx+.28&&Math.abs(z-o.z)<o.hz+.28);
   expect(blocker,`Walk blocked at ${x},${z} by ${blocker?.id}`).toBeUndefined();
  }
 });
 it('allows the player into the cleared former holographic-desk corner',()=>{
  for(const x of [2.4,2.8,3.2])for(const z of [-22.6,-22.9,-23.2]){
   expect(layout.colliders.some(o=>Math.abs(x-o.x)<o.hx+.28&&Math.abs(z-o.z)<o.hz+.28)).toBe(false);
  }
 });
});
