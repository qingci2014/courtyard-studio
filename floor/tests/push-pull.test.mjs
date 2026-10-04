import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/model.js';
import {makeSolid,offsetSolid,solidArea} from '../src/modeling.js';
import {applyPushPull,pullFaceInfo,resolvePullFace} from '../src/push-pull.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const setup=solid=>{const project=M.blankProject(),floor=project.floors[0];floor.solids.push(solid);return {project,floor,ref:{kind:'solid',id:solid.id,floorId:floor.id}};};
const rect=[[0,0],[4,0],[4,3],[0,3]];
test('top pulling preserves the base and returns a new validated project for undo',()=>{
 const {project,ref}=setup(makeSolid(rect,{height:1,base:.4})),before=M.clone(project),next=applyPushPull(project,ref,{type:'top'},.375);
 near(next.floors[0].solids[0].height,1.375);near(next.floors[0].solids[0].base,.4);assert.deepEqual(project,before);assert.throws(()=>applyPushPull(project,ref,{type:'top'},-1),/高度/);
});
test('side pulling works for both polygon windings and diagonal edges, fixing the opposite side',()=>{
 for(const poly of [rect,[...rect].reverse(),[[0,0],[3,1],[2,4],[-1,3]]]){
  const {project,ref,floor}=setup(makeSolid(poly)),face={type:'side',ring:0,edge:1},info=pullFaceInfo(floor,ref,face),next=applyPushPull(project,ref,face,.4).floors[0].solids[0];
  const a=next.poly[1],b=poly[1];near((a[0]-b[0])*info.normal[0]+(a[1]-b[1])*info.normal[2],.4);assert.deepEqual(next.poly[3],poly[3]);assert.ok(solidArea(next)>solidArea(floor.solids[0]));
 }
});
test('hollow and concave solids keep valid holes, reject collapsed edges and boundary intersections',()=>{
 const {project,ref,floor}=setup(offsetSolid(rect,{distance:.3,height:.2})),face={type:'side',ring:1,edge:0},next=applyPushPull(project,ref,face,.1).floors[0].solids[0];assert.ok(solidArea(next)>solidArea(floor.solids[0]));assert.deepEqual(next.poly,rect);assert.throws(()=>applyPushPull(project,ref,face,-.4));
 const c=setup(makeSolid([[0,0],[3,0],[3,1],[1,1],[1,3],[0,3]]));assert.ok(applyPushPull(c.project,c.ref,{type:'side',ring:0,edge:1},.5));assert.throws(()=>applyPushPull(c.project,c.ref,{type:'side',ring:0,edge:1},-3));
});
function wallProject(){const project=M.blankProject(),floor=project.floors[0];floor.walls=rect.map((a,i)=>M.wall({x:a[0],y:a[1]},{x:rect[(i+1)%4][0],y:rect[(i+1)%4][1]}));floor.rooms=M.refreshRooms(floor);floor.openings.push({id:M.uid(),type:'door',wallId:floor.walls[0].id,offset:1.5,width:1,height:2.1,sill:0,hinge:1});return {project,floor,ref:{kind:'wall',id:floor.walls[0].id,floorId:floor.id}};}
test('wall side pulls anchor the opposite skin, preserve rooms and move connected corners',()=>{
 const {project,floor,ref}=wallProject(),next=applyPushPull(project,ref,{type:'side',side:1},.2).floors[0],w=next.walls[0];near(w.thickness,.4);near(w.a.y,.1);near(w.a.y-w.thickness/2,-.1);assert.deepEqual(next.walls[1].a,w.b);assert.deepEqual(next.walls[3].b,w.a);assert.equal(next.rooms.length,1);assert.equal(next.openings[0].width,1);assert.deepEqual(floor.walls[0].a,{x:0,y:0});
});
test('wall end pulls keep door world position and reject clipping or silently shrinking openings',()=>{
 const {project,floor,ref}=wallProject(),next=applyPushPull(project,ref,{type:'end',end:'a'},.7).floors[0];near(next.walls[0].a.x,-.7);near(next.openings[0].offset,2.2);near(M.onWall(next.walls[0],next.openings[0].offset).x,1.5);
 assert.throws(()=>applyPushPull(project,ref,{type:'end',end:'a'},-1.2),/门窗/);assert.throws(()=>applyPushPull(project,ref,{type:'top'},-1),/门窗/);near(floor.openings[0].width,1);
});
test('locked neighbors and attached openings block geometry changes atomically',()=>{
 const {project,floor,ref}=wallProject();floor.walls[1].locked=true;assert.throws(()=>applyPushPull(project,ref,{type:'side',side:1},.1),/锁定/);floor.walls[1].locked=false;floor.openings[0].locked=true;assert.throws(()=>applyPushPull(project,ref,{type:'side',side:1},.1),/锁定/);
 const s=setup(makeSolid(rect));s.floor.solids[0].locked=true;assert.throws(()=>applyPushPull(s.project,s.ref,{type:'top'},.2),/锁定/);
});
test('face picking distinguishes whole-wall faces from door jambs, sills and bottom faces',()=>{
 const {floor,ref}=wallProject();assert.deepEqual(resolvePullFace(floor,ref,[1,2.8,0],[0,1,0]),{type:'top'});assert.deepEqual(resolvePullFace(floor,ref,[1,1,.1],[0,0,1]),{type:'side',side:1});assert.deepEqual(resolvePullFace(floor,ref,[4,1,0],[1,0,0]),{type:'end',end:'b'});
 assert.equal(resolvePullFace(floor,ref,[1,1,0],[1,0,0]),null);assert.equal(resolvePullFace(floor,ref,[1,2.1,0],[0,1,0]),null);assert.equal(resolvePullFace(floor,ref,[1,0,0],[0,-1,0]),null);
 const s=setup(makeSolid(rect,{base:1,height:2}));assert.deepEqual(resolvePullFace(s.floor,s.ref,[4,2,1],[1,0,0]),{type:'side',ring:0,edge:1});assert.deepEqual(resolvePullFace(s.floor,s.ref,[2,3,1],[0,1,0]),{type:'top'});
});
test('manual room contours and T junctions follow wall edits and survive save/reload',()=>{
 const {project,floor,ref}=wallProject();floor.rooms[0].manual=true;floor.walls.push(M.wall({x:2,y:0},{x:2,y:1}));const next=applyPushPull(project,ref,{type:'side',side:-1},.2);near(next.floors[0].walls.at(-1).a.y,-.1);near(Math.min(...next.floors[0].rooms[0].poly.map(p=>p[1])),-.1);assert.deepEqual(M.validateProject(JSON.parse(JSON.stringify(next))),next);
});
