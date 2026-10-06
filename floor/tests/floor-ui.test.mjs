import test from 'node:test';
import assert from 'node:assert/strict';
import {restoreActiveFloor,nextFloorName,floorContentLabel,quickModelSource} from '../src/floor-ui.js';
import {blankProject,makeFloor,clone,validateProject,normalizeEmptyFloorName} from '../src/model.js';

test('refresh restores a valid saved floor without reusing another project or deleted floor',()=>{
 const project=blankProject(),upper=makeFloor('二层');project.floors.push(upper);
 assert.equal(restoreActiveFloor(project,{projectId:project.id,floorId:upper.id}),upper.id);
 assert.equal(restoreActiveFloor(project,{projectId:'other-project',floorId:upper.id}),project.floors[0].id);
 assert.equal(restoreActiveFloor(project,{projectId:project.id,floorId:'deleted'}),project.floors[0].id);
 assert.equal(restoreActiveFloor(project,null),project.floors[0].id);
 project.floors.reverse();
 assert.equal(restoreActiveFloor(project,{projectId:project.id,floorId:upper.id}),upper.id);
});

test('quick modeling opens existing CAD or image data before offering a file import',()=>{
 const floor=makeFloor();assert.equal(quickModelSource(floor),'import');
 floor.cad={segments:[{a:{x:0,y:0},b:{x:1,y:0}}],hidden:true};assert.equal(quickModelSource(floor),'cad');
 floor.image={name:'plan.pdf'};assert.equal(quickModelSource(floor),'choose');
 floor.cad=null;assert.equal(quickModelSource(floor),'image');
 floor.image=null;floor.cad={segments:[]};assert.equal(quickModelSource(floor),'import');
});

test('adding or copying after a floor deletion avoids duplicate default names and preserves existing names',()=>{
 const floors=[makeFloor('2 层')],before=clone(floors);
 assert.equal(nextFloorName(floors),'3 层');
 assert.deepEqual(floors,before);
 floors.push(makeFloor('3层'));
 assert.equal(nextFloorName(floors),'4 层');
});

test('a floor without walls is only empty when it has no other model content',()=>{
 const floor=makeFloor();assert.match(floorContentLabel(floor),/空楼层/);
 floor.image={};assert.match(floorContentLabel(floor),/已导入图纸/);
 floor.furniture.push({id:'chair'});assert.match(floorContentLabel(floor),/家具/);
 assert.doesNotMatch(floorContentLabel(floor),/空楼层|尚未建模/);
 floor.furniture=[];floor.solids.push({id:'column'});
 assert.match(floorContentLabel(floor),/自建构件/);
});

test('a new blank project starts at floor 1 and an old empty floor 2 is repaired on load',()=>{
 const project=blankProject();assert.equal(project.floors[0].name,'1 层');
 project.floors[0].name='2 层';
 const restored=validateProject(project);
 assert.equal(restored.floors[0].name,'1 层');
 assert.equal(restored.floors[0].id,project.floors[0].id);
 assert.equal(project.floors[0].name,'2 层');
 assert.equal(normalizeEmptyFloorName(restored),false);
});

test('empty-floor recovery preserves populated floors, multiple floors, and names explicitly chosen by the user',()=>{
 const project=blankProject(),floor=project.floors[0];floor.name='2 层';
 floor.image={};assert.equal(normalizeEmptyFloorName(project),false);
 floor.image=null;floor.furniture.push({id:'chair'});assert.equal(normalizeEmptyFloorName(project),false);
 floor.furniture=[];project.floors.push(makeFloor());assert.equal(normalizeEmptyFloorName(project),false);
 project.floors.pop();floor.nameEdited=true;assert.equal(normalizeEmptyFloorName(project),false);
 floor.nameEdited=false;floor.name='屋顶花园';assert.equal(normalizeEmptyFloorName(project),false);
});
