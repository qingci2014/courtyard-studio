import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/model.js';
import {doorPose,updateOpening,resizeOpening,openingDragPatch} from '../src/openings.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7);
const setup=()=>{const p=M.blankProject(),f=p.floors[0],w=M.wall({x:0,y:0},{x:5,y:0}),o={id:M.uid(),type:'door',wallId:w.id,offset:.5,width:1,height:2.1,sill:0,hinge:1};f.walls.push(w);f.openings.push(o);return {p,f,w,o};};
test('all four door directions have matching plan and 3D hinge / leaf positions',()=>{
 for(const hinge of [-1,1])for(const swing of [-1,1]){const o={width:1.2,hinge,swing},pose=doorPose(o);near(pose.hingeX,-.6*hinge);near(Math.cos(pose.rotation)*1.2*hinge,0);near(-Math.sin(pose.rotation)*1.2*hinge,-1.2*swing);}
 assert.equal(doorPose({width:1}).swing,1);
});
test('enlarging a door near a wall end fits it without silently undoing the requested size',()=>{
 const {f,o}=setup();updateOpening(f,o.id,{width:1.4});near(o.width,1.4);near(o.offset,.7);updateOpening(f,o.id,{height:2.4});near(o.height,2.4);const before=M.clone(o);assert.throws(()=>updateOpening(f,o.id,{height:3}),/墙高/);assert.deepEqual(o,before);assert.throws(()=>updateOpening(f,o.id,{width:6}),/墙段长度/);
});
test('width grips keep the opposite edge fixed, including a diagonal wall',()=>{
 const {f,o,w}=setup();w.b={x:3,y:4};const original=M.clone(o);resizeOpening(f,o.id,original,'end',1.6);near(o.width,1.6);near(o.offset-o.width/2,0);resizeOpening(f,o.id,M.clone(o),'start',.3);near(o.width,1.3);near(o.offset+o.width/2,1.6);
});
test('component grips scale width / height separately or proportionally with opposite / centre anchors',()=>{
 const {f,o}=setup(),original=M.clone(o);updateOpening(f,o.id,openingDragPatch(original,'corner-right',.2));near(o.width,1.2);near(o.height,2.52);near(o.offset-o.width/2,0);
 assert.deepEqual(openingDragPatch(original,'left',.1,{center:true}),{width:1.2,offset:.5});assert.deepEqual(openingDragPatch(original,'top',.3),{height:2.4});assert.deepEqual(openingDragPatch(original,'move',.5),{offset:1});
});
test('overlaps and locked wall / door changes fail atomically',()=>{
 const {f,o,w}=setup();f.openings.push({...o,id:M.uid(),offset:2});const before=M.clone(o);assert.throws(()=>updateOpening(f,o.id,{width:2.5}),/重叠/);assert.deepEqual(o,before);o.locked=true;assert.throws(()=>updateOpening(f,o.id,{hinge:-1}),/锁定/);delete o.locked;w.locked=true;assert.throws(()=>updateOpening(f,o.id,{swing:-1}),/锁定/);
});
test('door direction and sizes persist through copies, project JSON and type changes',()=>{
 const {p,f,o}=setup();updateOpening(f,o.id,{hinge:-1,swing:-1,width:1.2,height:2.3});const saved=M.validateProject(JSON.parse(JSON.stringify(p)));assert.deepEqual(saved.floors[0].openings[0],o);const copy=M.duplicateFloor(f,'2 层');assert.equal(copy.openings[0].swing,-1);assert.equal(copy.openings[0].hinge,-1);updateOpening(f,o.id,{type:'window'});assert.equal(o.sill,.9);assert.equal(o.height,1.4);updateOpening(f,o.id,{type:'door'});assert.equal(o.sill,0);
});
