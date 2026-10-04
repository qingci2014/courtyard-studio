import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/model.js';
import * as E from '../src/editing.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function sample(){const f=M.makeFloor();f.furniture=[{id:'table',type:'table',name:'餐桌',x:3,y:4,w:2,d:1,rot:0},{id:'chair',type:'chair',name:'椅子',x:3,y:5,w:.5,d:.5,rot:30}];return f;}
const refs=f=>f.furniture.map(o=>({kind:'furniture',id:o.id}));
const wrap=f=>({version:2,units:'m',name:'编辑测试',roof:'none',floors:[f]});

test('group selection expands from any member; rotate and move preserve member spacing',()=>{
 const f=sample(),before=M.clone(f),r=E.groupSelection(f,refs(f));assert.equal(E.expandSelection(f,[r[0]]).length,2);
 E.transformSelection(f,[r[0]],{dx:.3,dy:-.6,angle:90});near(M.dist(f.furniture[0],f.furniture[1]),M.dist(before.furniture[0],before.furniture[1]));near(f.furniture[1].rot,120);
 E.ungroupSelection(f,[r[1]]);assert.ok(f.furniture.every(o=>!o.groupId));
});
test('arrays use original positions and give every copy an independent group identity',()=>{
 const f=sample();E.groupSelection(f,refs(f));const originals=M.clone(f.furniture),r=E.transformSelection(f,refs(f),{dx:2,copy:true,count:3});assert.equal(r.length,6);assert.equal(f.furniture.length,8);
 assert.equal(new Set(f.furniture.map(o=>o.groupId)).size,4);
 for(let i=1;i<=3;i++)for(let j=0;j<2;j++){near(f.furniture[i*2+j].x,originals[j].x+2*i);near(f.furniture[i*2+j].y,originals[j].y);}
 E.transformSelection(f,[r[0]],{dy:1});assert.deepEqual(f.furniture.slice(0,2),originals);near(f.furniture[4].y,originals[0].y);
});
test('two reflections restore positions and asymmetric local orientation',()=>{
 for(const axis of ['x','y']){const f=sample(),before=M.clone(f);E.transformSelection(f,refs(f),{mirror:axis});assert.ok(f.furniture.every(o=>o.mirrorX));E.transformSelection(f,refs(f),{mirror:axis});f.furniture.forEach((o,i)=>{near(o.x,before.furniture[i].x);near(o.y,before.furniture[i].y);near(o.rot,before.furniture[i].rot);assert.equal(o.mirrorX,false);});}
});
test('copying walls remaps attached openings and mirrors handedness exactly once',()=>{
 const f=sample(),w=M.wall({x:0,y:0},{x:8,y:0});f.walls=[w];f.openings=[{id:'door',wallId:w.id,offset:2,width:1,height:2.1,sill:0,type:'door',hinge:1}];
 const r=E.transformSelection(f,[{kind:'wall',id:w.id},{kind:'opening',id:'door'}],{copy:true,dy:4,mirror:'x'});assert.equal(r.length,2);assert.equal(f.openings.length,2);assert.equal(f.openings[1].wallId,f.walls[1].id);assert.equal(f.openings[1].hinge,-1);assert.deepEqual(M.onWall(f.walls[1],2),{x:6,y:4});
});
test('a bad window array is atomic and valid copies fit along the original wall',()=>{
 const f=M.makeFloor(),w=M.wall({x:0,y:0},{x:8,y:0});f.walls=[w];f.openings=[{id:'window',wallId:w.id,offset:1,width:1,height:1.4,sill:.9,type:'window'}];const r=[{kind:'opening',id:'window'}],before=M.clone(f);
 assert.throws(()=>E.transformSelection(f,r,{copy:true,dx:2,count:4}),/超出|方向/);assert.deepEqual(f,before);
 assert.throws(()=>E.transformSelection(f,r,{dy:1}),/方向/);assert.deepEqual(f,before);
 E.transformSelection(f,r,{copy:true,dx:2,count:3});assert.deepEqual(f.openings.map(o=>o.offset),[1,3,5,7]);
});
test('hidden and locked entities are omitted from box selection, groups expand as a whole',()=>{
 const f=sample();E.groupSelection(f,refs(f));assert.equal(E.boxSelection(f,{x:1,y:3},{x:4.1,y:4.6},{kind:'furniture'}).length,2);
 E.setFlag(f,[refs(f)[0]],'locked',true);assert.equal(E.boxSelection(f,{x:0,y:0},{x:10,y:10}).length,0);assert.throws(()=>E.transformSelection(f,refs(f),{dx:1}),/锁定/);
 E.setFlag(f,refs(f),'locked',false);E.setFlag(f,refs(f),'hidden',true);assert.equal(E.boxSelection(f,{x:0,y:0},{x:10,y:10}).length,0);
});
test('locked attached openings protect the parent wall and dependent edits are detected',()=>{
 const f=M.villaProject().floors[0],o=f.openings[0],w=f.walls.find(w=>w.id===o.wallId);o.locked=true;
 assert.throws(()=>E.transformSelection(f,[{kind:'wall',id:w.id}],{dx:1}),/锁定/);
 const p=wrap(f),q=M.clone(p);q.floors[0].openings[0].offset+=.1;assert.throws(()=>E.assertLocksPreserved(p,q),/锁定/);
 q.floors[0].openings[0].offset=o.offset;q.floors[0].openings[0].hidden=true;assert.doesNotThrow(()=>E.assertLocksPreserved(p,q));
});
test('clearance uses furniture outside edges and wall inner face in all four directions',()=>{
 const f=sample();f.walls=[M.wall({x:0,y:0},{x:0,y:10}),M.wall({x:10,y:0},{x:10,y:10}),M.wall({x:0,y:0},{x:10,y:0}),M.wall({x:0,y:10},{x:10,y:10})];
 for(const side of ['left','right','top','bottom']){const c=M.clone(f),r=[refs(c)[0]];E.transformSelection(c,r,E.wallClearance(c,r,side,.6));const b=M.furnitureBounds(c.furniture[0]);near(side==='left'?b.x0-.1:side==='right'?9.9-b.x1:side==='top'?b.y0-.1:9.9-b.y1,.6);}
});
test('reference lines snap furniture edges and points; disabled snapping remains exact',()=>{
 const f=sample();f.guides=[{id:'guide',axis:'x',value:5}];const item=f.furniture[0],snap=M.snapFurnitureMove(item,{x:3.91,y:2.17},f,{threshold:.15});near(snap.x+item.w/2,5);assert.ok(snap.label.includes('参考线'));
 assert.deepEqual(E.snapGuidePoint({x:4.98,y:2.17},f.guides,.1).point,{x:5,y:2.17});assert.equal(M.snapFurnitureMove(item,{x:3.91,y:2.17},f,{enabled:false}).x,3.91);
});
test('JSON and floor duplication preserve flags, reflection and guides while remapping groups',()=>{
 const f=sample();E.groupSelection(f,refs(f));f.furniture[0].mirrorX=true;f.furniture[0].locked=true;f.furniture[1].hidden=true;f.guides=[{id:'guide',axis:'y',value:4.25,locked:true}];
 const q=M.validateProject(JSON.parse(JSON.stringify(wrap(f)))).floors[0];assert.equal(q.furniture[0].mirrorX,true);assert.equal(q.furniture[1].hidden,true);assert.equal(q.guides[0].value,4.25);
 const copy=M.duplicateFloor(q,'二层');assert.notEqual(copy.furniture[0].groupId,q.furniture[0].groupId);assert.equal(copy.furniture[0].groupId,copy.furniture[1].groupId);assert.notEqual(copy.guides[0].id,q.guides[0].id);
});
test('invalid reference lines and huge transforms are rejected without partial mutation',()=>{
 const f=sample(),before=M.clone(f);assert.throws(()=>E.transformSelection(f,refs(f),{dx:500}));assert.deepEqual(f,before);
 f.guides=[{id:'bad',axis:'z',value:0}];assert.throws(()=>M.validateProject(wrap(f)),/参考线/);
});
