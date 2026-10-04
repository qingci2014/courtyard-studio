import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3} from 'three';
import {buildFurniture,furnitureMetrics} from '../src/assets.js';
import * as M from '../src/model.js';
import * as E from '../src/editing.js';
import {sceneBounds} from '../src/modeling.js';
import {walkBlocked} from '../src/walk-navigation.js';

const item=(type='tv')=>({id:M.uid(),type,x:2,y:3,w:1.23,d:.08,rot:0});
const mesh=o=>buildFurniture({...o,w:o.w*1000,d:o.d*1000,cx:o.x*1000,cy:o.y*1000});
const dispose=o=>o.traverse(child=>child.geometry?.dispose());
test('Z sets the actual bottom of wall-mounted and floor furniture without changing legacy positions or sizes',()=>{
 for(const type of ['tv','acwall','bed','plant']){
  const original=item(type),before=mesh(original),box=new Box3().setFromObject(before),metrics=furnitureMetrics(original);
  assert.ok(Math.abs(box.min.y-metrics.base)<1e-7);
  for(const z of [0,1.4,-.2]){const raised=mesh({...original,z}),after=new Box3().setFromObject(raised);assert.ok(Math.abs(after.min.y-z)<1e-7);assert.ok(Math.abs(after.max.y-after.min.y-metrics.height)<1e-7);assert.equal(after.min.x,box.min.x);assert.equal(after.max.z,box.max.z);dispose(raised);}
  assert.equal(before.position.y,0);dispose(before);
 }
});
test('furniture Z survives copying, rotating, resizing, calibration, duplicated floors and saved project reloads',()=>{
 const p=M.blankProject(),f=p.floors[0],o={...item(),z:1.4};f.furniture.push(o);
 const refs=E.transformSelection(f,[{kind:'furniture',id:o.id}],{copy:true,dx:2,angle:90});
 assert.equal(E.entity(f,refs[0]).z,1.4);
 f.image={data:'data:image/png;base64,AA==',x:0,y:0,width:15,pixelWidth:800,pixelHeight:600,opacity:.5};
 M.calibrateFloor(f,{x:0,y:0},{x:10,y:0},20,{scaleModel:true});
 p.floors.push(M.duplicateFloor(f,'二层'));
 assert.ok(M.validateProject(JSON.parse(JSON.stringify(p))).floors.every(f=>f.furniture.every(o=>o.z===1.4)));
 for(const z of ['1',NaN,Infinity,17,-17])assert.throws(()=>M.validateProject({...p,floors:[{...f,furniture:[{...o,z}]}]}),/离地高度/);
});
test('raised furniture extends section travel and no longer blocks walking below it',()=>{
 const p=M.blankProject(),f=p.floors[0],o={...item(),z:1.2};f.furniture.push(o);
 assert.equal(walkBlocked({x:o.x,y:o.y},f),true);
 o.z=4;assert.equal(walkBlocked({x:o.x,y:o.y},f),false);
 assert.ok(sceneBounds(p).height[1]>4+furnitureMetrics(o).height);
});
