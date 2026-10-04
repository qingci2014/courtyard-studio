import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/model.js';
import * as E from '../src/editing.js';
import {makeSolid,rectangleContour,offsetSolid,insetContour,solidArea,sectionEquation,sceneBounds,validateScene,projectedDragDelta} from '../src/modeling.js';
import {solidGeometry} from '../src/modeling-mesh.js';

const rect=[[0,0],[6,0],[6,4],[0,4]];
test('dragging along the projected axis keeps metre scale and ignores perpendicular motion',()=>{for(const [x,y] of [[0,-40],[30,20],[-2,-41.5]]){assert.ok(Math.abs(projectedDragDelta(x*2.25,y*2.25,x,y)-2.25)<1e-9);assert.ok(Math.abs(projectedDragDelta(-y,x,x,y))<1e-9);}assert.equal(projectedDragDelta(10,10,0,0),0);});
const volume=g=>{const p=g.attributes.position;let sum=0;for(let i=0;i<p.count;i+=3){const a=[p.getX(i),p.getY(i),p.getZ(i)],b=[p.getX(i+1),p.getY(i+1),p.getZ(i+1)],c=[p.getX(i+2),p.getY(i+2),p.getZ(i+2)];sum+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;}return Math.abs(sum);};
test('small columns and concave solids have the intended finite volume at an elevated base',()=>{
 for(const [poly,height,base] of [[rectangleContour({x:1,y:1},{x:1.4,y:1.4}),2.8,0],[[[0,0],[3,0],[3,1],[1,1],[1,3],[0,3]],.2,.45]]){const s=makeSolid(poly,{height,base}),g=solidGeometry(s);assert.ok(Math.abs(volume(g)-solidArea(s)*height)<1e-5);g.computeBoundingBox();assert.ok(Math.abs(g.boundingBox.min.y-base)<1e-5);assert.ok(Math.abs(g.boundingBox.max.y-base-height)<1e-5);assert.ok([...g.attributes.position.array].every(Number.isFinite));g.dispose();}
});
test('offset bands leave a real hole through the extrusion and preserve the source',()=>{
 const before=JSON.stringify(rect),s=offsetSolid(rect,{distance:.2,height:.12,base:2.68}),g=solidGeometry(s);assert.equal(s.holes.length,1);assert.ok(Math.abs(solidArea(s)-(24-5.6*3.6))<1e-7);assert.ok(Math.abs(volume(g)-solidArea(s)*.12)<1e-5);assert.equal(JSON.stringify(rect),before);g.dispose();
});
test('insetting a concave neck may produce two holes without corrupting the band',()=>{
 const neck=[[0,0],[3,0],[3,1.4],[5,1.4],[5,0],[8,0],[8,4],[5,4],[5,2.6],[3,2.6],[3,4],[0,4]];
 const inner=insetContour(neck,.7);assert.equal(inner.inner.length,2);const s=offsetSolid(neck,{distance:.7,height:.2}),g=solidGeometry(s);assert.ok(Math.abs(volume(g)-solidArea(s)*s.height)<1e-5);g.dispose();assert.throws(()=>insetContour(rect,3),/过大/);
});
test('self intersections, escaping holes, invalid heights and duplicate solid IDs are rejected',()=>{
 assert.throws(()=>makeSolid([[0,0],[3,3],[0,3],[3,0]]));assert.throws(()=>makeSolid(rect,{height:0}));assert.throws(()=>makeSolid(rect,{holes:[[[5,1],[7,1],[7,3],[5,3]]]}));const p=M.blankProject(),solid=makeSolid(rect);p.floors[0].solids.push(solid,M.clone(solid));assert.throws(()=>M.validateProject(p),/编号/);
});
test('solids keep holes and height through mirroring, duplication and project round-trip, and obey locks',()=>{
 const p=M.blankProject(),f=p.floors[0],s=offsetSolid(rect,{height:.3,base:.5});f.solids.push(s);const refs=[{kind:'solid',id:s.id}],area=solidArea(s);E.transformSelection(f,refs,{mirror:'x'});E.transformSelection(f,refs,{mirror:'x'});assert.ok(Math.abs(solidArea(f.solids[0])-area)<1e-7);const copies=E.transformSelection(f,refs,{copy:true,dx:8});assert.equal(copies.length,1);const f2=M.duplicateFloor(f,'二层');assert.equal(new Set([...f.solids,...f2.solids].map(s=>s.id)).size,4);p.floors.push(f2);assert.deepEqual(M.validateProject(JSON.parse(JSON.stringify(p))),p);f.solids[0].locked=true;assert.throws(()=>E.transformSelection(f,refs,{dy:2}),/锁定/);
});
test('grouped offset solids calibrate in XY without changing their vertical dimensions',()=>{
 const p=M.blankProject(),f=p.floors[0];f.solids.push(offsetSolid(rect,{height:.3,base:.5}),makeSolid([[8,0],[9,0],[9,1],[8,1]],{height:2}));
 E.groupSelection(f,f.solids.map(o=>({kind:'solid',id:o.id})));assert.equal(E.expandSelection(f,[{kind:'solid',id:f.solids[0].id}]).length,2);
 f.image={data:'data:image/png;base64,AA==',x:0,y:0,width:15,pixelWidth:800,pixelHeight:600,opacity:.5};const before=M.clone(f.solids[0]);M.calibrateFloor(f,{x:0,y:0},{x:10,y:0},20,{scaleModel:true});
 const after=f.solids[0];assert.equal(after.height,before.height);assert.equal(after.base,before.base);assert.equal(after.groupId,f.solids[1].groupId);assert.deepEqual(after.holes,before.holes.map(poly=>poly.map(p=>p.map(n=>n*2))));assert.ok(Math.abs(solidArea(after)-solidArea(before)*4)<1e-7);
});
test('section travel includes the roof and the upper storey in an exploded view',()=>{
 const p=M.blankProject();p.floors[0].walls.push(M.wall({x:0,y:0},{x:6,y:0}));p.floors.push(M.duplicateFloor(p.floors[0],'二层'));p.roof='gable';
 const normal=sceneBounds(p),separated=sceneBounds(p,{exploded:true});assert.ok(normal.height[1]>5.6+1.65);assert.ok(Math.abs(separated.height[1]-normal.height[1]-2.3)<1e-7);assert.ok(sceneBounds(p,{roofVisible:false}).height[1]<normal.height[1]);
});
test('section equations retain the requested half space along each axis and can flip it',()=>{
 for(const axis of ['x','y','height']){const point=axis==='x'?[3,0,0]:axis==='y'?[0,0,3]:[0,3,0];const a=sectionEquation({axis,position:2}),b=sectionEquation({axis,position:2,flipped:true}),distance=p=>p.normal.reduce((n,v,i)=>n+v*point[i],p.constant);assert.ok(distance(a)<0);assert.ok(distance(b)>0);}
});
test('scenes survive JSON with exact camera, clipping, roof and visibility states',()=>{
 const p=M.blankProject(),f=p.floors[0],solid=makeSolid(rect);f.solids.push(solid);const scene=validateScene({id:M.uid(),name:'剖切视角',camera:{position:[12,8,10],target:[3,1,2]},plan:{x:-2,y:-1,w:18,h:12},view:{mode:'split',floorId:f.id,show:'current',section:{axis:'x',position:3.75,flipped:true},cut:true,roofVisible:false},visibility:[{floorId:f.id,kind:'solid',id:solid.id,hidden:true}]});p.scenes.push(scene);assert.deepEqual(M.validateProject(JSON.parse(JSON.stringify(p))).scenes,[scene]);assert.throws(()=>validateScene({...scene,camera:{position:[0,0,0],target:[0,0,0]}}));assert.throws(()=>M.validateProject({...p,scenes:[scene,scene]}),/重复/);
});
test('legacy projects without solids or scenes load with empty collections',()=>{const p=M.blankProject();delete p.scenes;delete p.floors[0].solids;const valid=M.validateProject(p);assert.deepEqual(valid.scenes,[]);assert.deepEqual(valid.floors[0].solids,[]);});
