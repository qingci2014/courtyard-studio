import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/model.js';
import {polygonContains,polygonsOverlap} from '../src/room-geometry.js';
import hallFixture from './fixtures/hall-gap.json' with {type:'json'};

test('a drafting gap no longer drops the central hall or changes existing rooms',()=>{
 const f=M.clone(hallFixture),before=M.clone(f),added=M.missingRooms(f);
 assert.equal(added.length,1);assert.ok(M.pointIn({x:7,y:3},added[0].poly));
 assert.ok(M.area(added[0].poly)>80&&M.area(added[0].poly)<90);
 assert.ok(f.rooms.every(r=>!polygonsOverlap(r.poly,added[0].poly)));
 assert.deepEqual(f,before);f.rooms.push(...added);assert.equal(M.missingRooms(f).length,0);assert.doesNotThrow(()=>M.checkRoomEdit(f,added[0]));
 const refreshed=M.refreshRooms(f);assert.equal(new Set(refreshed.map(r=>r.id)).size,5);
 for(const r of before.rooms)assert.ok(refreshed.some(q=>q.id===r.id&&q.name===r.name&&q.mat===r.mat));
});
test('corner-gap recovery works with rotated plans and leaves real geometry untouched',()=>{
 for(const angle of [0,23,90]){
  const f=M.makeFloor(),rad=angle*Math.PI/180,p=(x,y)=>({x:x*Math.cos(rad)-y*Math.sin(rad)+7,y:x*Math.sin(rad)+y*Math.cos(rad)-2});
  f.walls=[[0,0,9.6,0],[10,.15,10,8],[10,8,0,8],[0,8,0,0]].map(q=>({...M.wall(p(q[0],q[1]),p(q[2],q[3]),.3),inferred:true}));
  const before=M.clone(f),rooms=M.detectRooms(f);assert.equal(rooms.length,1);assert.ok(Math.abs(M.area(rooms[0].poly)-80)<.001);assert.deepEqual(f,before);
 }
});
test('an open exterior with a large missing wall is not closed speculatively',()=>{
 const f=M.makeFloor();f.walls=[[0,0,8,0],[10,1.5,10,8],[10,8,0,8],[0,8,0,0]].map(q=>({...M.wall({x:q[0],y:q[1]},{x:q[2],y:q[3]}),inferred:true}));assert.equal(M.detectRooms(f).length,0);
});
test('manual concave ground contours remain selectable and survive refresh/export',()=>{
 const f=M.makeFloor(),points=[[0,0],[6,0],[6,2],[2,2],[2,6],[0,6]],r=M.manualRoom(f,points);r.name='开放式大厅';r.mat='terrazzo';f.rooms.push(r);
 assert.equal(f.walls.length,0);const c=M.roomLabelPoint(r.poly);assert.ok(polygonContains([c.x,c.y],r.poly,true));
 assert.equal(M.area(r.poly),20);f.rooms=M.refreshRooms(f);assert.deepEqual(f.rooms,[r]);
 const p=M.blankProject();p.floors=[f];assert.deepEqual(M.validateProject(JSON.parse(JSON.stringify(p))).floors[0].rooms,[r]);
});
test('manual repairs accept shared boundaries but reject overlap and self-crossing',()=>{
 const f=M.makeFloor();f.rooms.push(M.manualRoom(f,[[0,0],[3,0],[3,3],[0,3]]));const before=M.clone(f);
 assert.doesNotThrow(()=>M.manualRoom(f,[[3,0],[5,0],[5,3],[3,3]]));
 assert.throws(()=>M.manualRoom(f,[[2,1],[5,1],[5,4],[2,4]]),/重叠/);
 assert.throws(()=>M.manualRoom(f,[[5,0],[8,3],[5,3],[8,0]]),/交叉/);assert.deepEqual(f,before);
 const r=M.manualRoom(f,[[4,0],[7,0],[7,3],[4,3]]);f.rooms.push(r);r.poly[0]=[2,1];assert.throws(()=>M.checkRoomEdit(f,r),/重叠/);
});
test('splitting walls preserves opening world positions and rejects cuts through openings',()=>{
 const f=M.makeFloor(),w=M.wall({x:0,y:0},{x:10,y:0});f.walls.push(w);
 f.openings=[{id:'door',wallId:w.id,type:'door',offset:2,width:1,height:2.1,sill:0},{id:'window',wallId:w.id,type:'window',offset:8,width:1.5,height:1.5,sill:.9}];
 const before=M.clone(f);assert.throws(()=>M.splitWall(f,w.id,{x:2,y:0}),/门窗/);assert.deepEqual(f,before);
 const second=M.splitWall(f,w.id,{x:5,y:.1});assert.equal(f.walls.length,2);assert.deepEqual(w.b,{x:5,y:0});assert.equal(f.openings[0].wallId,w.id);assert.equal(f.openings[1].wallId,second.id);
 assert.deepEqual(M.onWall(second,f.openings[1].offset),{x:8,y:0});
});
test('connecting perpendicular endpoints fills a corner without moving existing walls',()=>{
 const f=M.makeFloor(),a=M.wall({x:0,y:0},{x:4,y:0}),b=M.wall({x:5,y:1},{x:5,y:4});f.walls=[a,b];const before=M.clone(f.walls);
 const added=M.connectWallEnds(f,{id:a.id,end:'b'},{id:b.id,end:'a'});assert.equal(added.length,2);assert.deepEqual(f.walls.slice(0,2),before);
 assert.deepEqual(added[0].b,{x:5,y:0});assert.deepEqual(added[1].a,{x:5,y:0});assert.equal(f.walls.length,4);
 assert.throws(()=>M.connectWallEnds(f,{id:a.id,end:'a'},{id:a.id,end:'b'}),/不同墙/);
});
