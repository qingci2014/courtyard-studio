import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/model.js';
import {parseCAD,prepareCAD,applyCAD,decodeDxf,clipCADSegment} from '../src/cad.js';
import {dxf,line,poly,insert,block,doublePlan} from './fixtures/cad-plans.mjs';
const options={unit:'mm',layers:['A-WALL'],inferDoors:false};
const near=(a,b,t=.00001)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
test('millimetre DXF double walls become four 200 mm walls and one correctly sized room',()=>{
 const raw=parseCAD(dxf(doublePlan())),result=prepareCAD(raw,options);assert.equal(raw.unit,'mm');assert.equal(raw.layers.length,2);assert.equal(raw.ignored,1);assert.equal(result.walls.length,4);assert.equal(result.review.length,0);
 result.walls.forEach(w=>near(w.thickness,.2));result.walls.map(M.length).sort((a,b)=>a-b).forEach((v,i)=>near(v,[7.8,7.8,11.8,11.8][i]));
 const f=M.makeFloor();applyCAD(f,result);assert.equal(f.rooms.length,1);near(M.area(f.rooms[0].poly),11.8*7.8);assert.equal(f.cad.segments.length,8);
});
test('door gaps are merged into a real opening and can be left open when inference is disabled',()=>{
 const raw=parseCAD(dxf(doublePlan({door:true}))),result=prepareCAD(raw,{...options,inferDoors:true});assert.equal(result.walls.length,4);assert.equal(result.openings.length,1);near(result.openings[0].width,1);
 const f=M.makeFloor();applyCAD(f,result);assert.equal(f.rooms.length,1);assert.ok(M.wallCells(f.walls.find(w=>w.id===f.openings[0].wallId),f.openings,2.8).some(c=>c.lo===2.1));assert.equal(prepareCAD(raw,options).openings.length,0);
});
test('a door gap at a crossing attaches to its parallel wall, not the crossing wall',()=>{
 const raw=parseCAD(dxf(line([3500,-2000],[3500,2000])+line([0,0],[3000,0])+line([4000,0],[7000,0]))),result=prepareCAD(raw,{...options,mode:'center',inferDoors:true});assert.equal(result.openings.length,1);const w=result.walls.find(w=>w.id===result.openings[0].wallId);near(w.a.y,w.b.y);
});
test('reversed endpoints, rotated nested blocks and large survey origins preserve length and thickness',()=>{
 const original=doublePlan({offset:[1000000,2000000]});
 const raw=parseCAD(dxf(insert('outer',{x:50000,y:20000,angle:27}),{blocks:block('inner',original,[1000000,2000000])+block('outer',insert('inner',{x:800,y:500,angle:16}))})),result=prepareCAD(raw,options);
 assert.equal(result.walls.length,4);result.walls.map(M.length).sort((a,b)=>a-b).forEach((v,i)=>near(v,[7.8,7.8,11.8,11.8][i]));result.walls.forEach(w=>near(w.thickness,.2));
});
test('units are explicit, feet convert exactly, and single lines retain their CAD coordinates',()=>{
 const raw=parseCAD(dxf(poly([[0,0],[40,0],[40,30],[0,30]]),{unit:2}));assert.equal(raw.unit,'ft');const result=prepareCAD(raw,{...options,unit:'ft',mode:'center'});near(result.bounds.w,12.192);near(result.bounds.h,9.144);assert.equal(result.walls.length,4);
 assert.equal(parseCAD(dxf(line([0,0],[10,0]),{unit:0})).unit,'');assert.throws(()=>prepareCAD(raw,{...options,unit:''}),/单位/);
});
test('model-space layer inheritance and curves are respected without turning door arcs into walls',()=>{
 const entities=line([0,0],[10000,0],'A-WALL',[67,1])+insert('lines',{x:1000,y:2000})+poly([[0,0,1],[1000,0]],{closed:false});
 const raw=parseCAD(dxf(entities,{blocks:block('lines',line([0,0],[4000,0],'0'))}));assert.ok(raw.segments.every(s=>s.layer==='A-WALL'));assert.ok(raw.segments.some(s=>s.curve));
 const result=prepareCAD(raw,{...options,mode:'center'});assert.equal(result.walls.length,1);near(M.length(result.walls[0]),4);assert.ok(result.curves>0);
});
test('cropping selects one floor and clips crossing lines before translating to local coordinates',()=>{
 const s={a:{x:0,y:0},b:{x:10,y:0}},clipped=clipCADSegment(s,{x:2,y:-1,w:5,h:2});assert.deepEqual(clipped,{a:{x:2,y:0},b:{x:7,y:0}});
 const raw=parseCAD(dxf(poly([[0,0],[6000,0],[6000,4000],[0,4000]])+poly([[20000,0],[26000,0],[26000,4000],[20000,4000]]))),result=prepareCAD(raw,{...options,mode:'center',crop:{x:19000,y:-5000,w:8000,h:6000},x:2,y:3});
 assert.equal(result.walls.length,4);assert.deepEqual(result.bounds,{x:2,y:3,w:6,h:4});
});
test('CAD import and replacement are atomic, preserve authored objects, obey locks and survive JSON/floor copies',()=>{
 const result=prepareCAD(parseCAD(dxf(doublePlan())),options),f=M.makeFloor(),authored=M.wall({x:20,y:0},{x:20,y:4});f.walls.push(authored);
 applyCAD(f,result,{name:'一层.dxf'});const saved=M.clone(f);assert.throws(()=>applyCAD(f,result,{selectedIds:[],replace:true}),/至少/);assert.deepEqual(f,saved);
 const fresh=prepareCAD(parseCAD(dxf(doublePlan())),options);applyCAD(f,fresh,{name:'一层.dxf',replace:true});assert.equal(f.walls.length,5);assert.ok(f.walls.some(w=>w.id===authored.id));
 f.walls.find(w=>w.cadImportId).locked=true;const locked=M.clone(f);assert.throws(()=>applyCAD(f,fresh,{replace:true}),/锁定/);assert.deepEqual(f,locked);
 const p=M.blankProject();p.floors=[f,M.duplicateFloor(f,'二层')];const round=M.validateProject(JSON.parse(JSON.stringify(p)));assert.deepEqual(round.floors[1].cad.segments,f.cad.segments);
 round.floors[0].cad.segments[0].a.x=Infinity;assert.throws(()=>M.validateProject(round),/CAD/);
});
test('malformed DXF, excessive dimensions and recursive blocks fail or report skipped data',()=>{
 assert.throws(()=>parseCAD('not dxf'));assert.throws(()=>parseCAD(dxf(line([0,0],[1,0])).replace(/EOF\s*$/,'')));assert.throws(()=>decodeDxf(new TextEncoder().encode('AutoCAD Binary DXF\r\n').buffer),/二进制/);
 const raw=parseCAD(dxf(insert('self')+line([0,0],[10000,0]),{blocks:block('self',insert('self'))}));assert.match(raw.warnings.join(''),/递归/);assert.throws(()=>prepareCAD(raw,{...options,unit:'m'}),/450/);
});
