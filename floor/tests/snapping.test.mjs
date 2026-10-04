import test from 'node:test';
import assert from 'node:assert/strict';
import {wall,makeFloor,snapFurnitureMove,snapPlanPoint,furnitureBounds} from '../src/model.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const bed={id:'bed',x:4,y:4,w:1.8,d:2,rot:90};

test('a rotated furniture edge snaps to the inside face of a wall, not its centreline',()=>{
 const f=makeFloor();f.walls=[wall({x:10,y:0},{x:10,y:8},.3)];f.furniture=[bed];
 const r=snapFurnitureMove(bed,{x:8.74,y:4.34},f,{threshold:.2});
 near(r.x,8.85);near(furnitureBounds({...bed,...r}).x1,9.85);
 assert.equal(r.guides.length,1);assert.equal(r.label,'贴墙');near(r.guides[0].value,9.85);
});
test('furniture snaps to two perpendicular wall faces at a corner',()=>{
 const f=makeFloor();f.walls=[wall({x:10,y:0},{x:10,y:8},.2),wall({x:0,y:8},{x:10,y:8},.2)];
 const r=snapFurnitureMove(bed,{x:8.82,y:6.91},f,{threshold:.2});
 near(r.x,8.9);near(r.y,7);assert.equal(r.guides.length,2);
});
test('furniture aligns centres and neighbouring edges with guide lines',()=>{
 const f=makeFloor();f.furniture=[bed,{id:'other',x:7,y:4,w:2,d:2,rot:0}];
 const centre=snapFurnitureMove(bed,{x:4.37,y:4.01},f,{threshold:.15});
 near(centre.y,4);assert.ok(centre.guides.some(g=>g.axis==='y'&&g.label==='家具对齐'));
 const edge=snapFurnitureMove(bed,{x:4.91,y:4},f,{threshold:.15});
 near(furnitureBounds({...bed,...edge}).x1,6);
});
test('turning snapping off gives exact free movement and no guides',()=>{
 const f=makeFloor();f.walls=[wall({x:10,y:0},{x:10,y:8})];f.furniture=[bed];
 const desired={x:8.8237,y:4.3349},r=snapFurnitureMove(bed,desired,f,{enabled:false});
 near(r.x,desired.x);near(r.y,desired.y);assert.deepEqual(r.guides,[]);assert.equal(r.label,'');
});
test('distant walls and the item itself do not attract furniture',()=>{
 const f=makeFloor();f.walls=[wall({x:10,y:0},{x:10,y:1})];f.furniture=[bed];
 const r=snapFurnitureMove(bed,{x:8.81,y:7.33},f,{threshold:.2});
 assert.equal(r.guides.length,0);assert.equal(r.label,'网格 0.1 m');near(r.x,8.8);near(r.y,7.3);
});
test('plan point snapping prioritises corners and supports wall interiors',()=>{
 const f=makeFloor();f.walls=[wall({x:0,y:0},{x:5,y:0})];
 const corner=snapPlanPoint({x:.12,y:.05},f,.2);assert.deepEqual(corner.point,{x:0,y:0});assert.equal(corner.label,'墙角吸附');
 const middle=snapPlanPoint({x:2.36,y:.08},f,.2);near(middle.point.x,2.36);near(middle.point.y,0);assert.equal(middle.label,'墙线吸附');
 const ignored=snapPlanPoint({x:2.36,y:.08},f,.2,{ignoreWallId:f.walls[0].id});assert.equal(ignored.label,'网格 0.1 m');
});
