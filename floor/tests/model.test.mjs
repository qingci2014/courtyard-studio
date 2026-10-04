import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/model.js';
import {detectRaster} from '../src/recognition.js';

test('late calibration rescales a preview consistently while preserving vertical sizes',()=>{
 const f=M.villaProject().floors[0];
 f.image={data:'data:image/png;base64,AA==',x:-1,y:-2,width:15,pixelWidth:800,pixelHeight:600,opacity:.5,calibrated:false,crop:{x:0,y:0,w:10,h:8}};
 const before=M.clone(f),ratio=M.calibrateFloor(f,{x:2,y:3},{x:12,y:3},20,{scaleModel:true});
 assert.equal(ratio,2);assert.equal(f.height,before.height);
 assert.equal(f.image.width,30);assert.equal(f.image.calibrated,true);assert.deepEqual(f.image.crop,{x:-2,y:-3,w:20,h:16});
 f.walls.forEach((w,i)=>{assert.equal(M.length(w),2*M.length(before.walls[i]));assert.equal(w.thickness,2*before.walls[i].thickness);});
 f.openings.forEach((o,i)=>{const b=before.openings[i];assert.equal(o.width,2*b.width);assert.equal(o.offset,2*b.offset);assert.equal(o.height,b.height);assert.equal(o.sill,b.sill);});
 f.rooms.forEach((r,i)=>assert.ok(Math.abs(M.area(r.poly)-4*M.area(before.rooms[i].poly))<1e-8));
 f.furniture.forEach((o,i)=>assert.equal(o.w,2*before.furniture[i].w));
 f.stairs.forEach((o,i)=>assert.equal(o.d,2*before.stairs[i].d));
});
test('image-only calibration preserves the model and invalid scaling is atomic',()=>{
 const f=M.villaProject().floors[0];
 f.image={data:'data:image/png;base64,AA==',x:0,y:0,width:15,pixelWidth:800,pixelHeight:600,opacity:.5,calibrated:false};
 const walls=M.clone(f.walls);M.calibrateFloor(f,{x:0,y:0},{x:10,y:0},15);
 assert.deepEqual(f.walls,walls);assert.equal(f.image.width,22.5);
 const before=M.clone(f);
 assert.throws(()=>M.calibrateFloor(f,{x:0,y:0},{x:.1,y:0},200,{scaleModel:true}));
 assert.deepEqual(f,before);
});

test('closed walls produce independent bounded rooms with T intersections',()=>{const f=M.makeFloor();[[0,0,10,0],[10,0,10,8],[10,8,0,8],[0,8,0,0],[4,0,4,8],[4,3,10,3]].forEach(q=>f.walls.push(M.wall({x:q[0],y:q[1]},{x:q[2],y:q[3]})));const rooms=M.detectRooms(f);assert.equal(rooms.length,3);assert.equal(rooms.reduce((s,r)=>s+M.area(r.poly),0),80);});
test('wall openings remove solid volume, including overlapping vertical cuts',()=>{const w=M.wall({x:0,y:0},{x:10,y:0});const cells=M.wallCells(w,[{wallId:w.id,offset:2,width:1,height:2.1,sill:0},{wallId:w.id,offset:6,width:2,height:1.5,sill:.9}],2.8);const volume=cells.reduce((s,c)=>s+(c.b-c.a)*(c.hi-c.lo),0);assert.ok(Math.abs(volume-(28-2.1-3))<1e-8);assert.ok(cells.every(c=>c.b>c.a&&c.hi>c.lo));});
test('editing a wall endpoint preserves attached corners and room closure',()=>{const f=M.villaProject().floors[0],before=M.clone(f),w=f.walls[0];M.changeWall(f,before,w.id,w.a,{x:14,y:0});assert.deepEqual(f.walls[1].a,{x:14,y:0});assert.equal(M.detectRooms(f).length,5);});
test('opening placement rejects overlapping doors and out of bounds windows',()=>{const f=M.makeFloor(),w=M.wall({x:0,y:0},{x:5,y:0});f.walls.push(w);f.openings.push({id:'door1',wallId:w.id,offset:2,width:1});assert.equal(M.canPlaceOpening(f,{id:'door2',wallId:w.id,offset:2.5,width:1}),false);assert.equal(M.canPlaceOpening(f,{id:'win',wallId:w.id,offset:4,width:1}),true);assert.equal(M.canPlaceOpening(f,{id:'win',wallId:w.id,offset:4.8,width:1}),false);});
test('floor duplication remaps opening parents and preserves all geometry',()=>{const f=M.villaProject().floors[0],n=M.duplicateFloor(f,'二层');assert.notEqual(n.id,f.id);assert.equal(n.openings.length,f.openings.length);assert.ok(n.openings.every(o=>n.walls.some(w=>w.id===o.wallId)));assert.ok(n.walls.every(w=>!f.walls.some(a=>a.id===w.id)));});
test('complete project round-trip keeps floors, doors, materials and furniture',()=>{for(const p of[M.villaProject(),M.referenceProject()]){const q=M.validateProject(JSON.parse(JSON.stringify(p)));assert.equal(q.floors.length,p.floors.length);assert.equal(q.floors[0].furniture.length,p.floors[0].furniture.length);assert.equal(q.floors[0].openings.length,p.floors[0].openings.length);}});
test('editing the imported reference preserves its authored open-space partitions',()=>{const f=M.referenceProject().floors[0],base=M.clone(f),w=f.walls[0];M.changeWall(f,base,w.id,{x:w.a.x,y:w.a.y-.1},{x:w.b.x,y:w.b.y-.1});f.rooms=M.refreshRooms(f);assert.ok(f.rooms.length>=11);assert.ok(f.rooms.some(r=>r.name==='客厅'));});
test('unsafe or structurally broken imports are rejected or normalized',()=>{const p=M.villaProject();p.floors[0].walls[0].a.x=Infinity;assert.throws(()=>M.validateProject(p));const q=M.villaProject();q.floors[0].walls[0].color='" onload="alert(1)';assert.equal(M.validateProject(q).floors[0].walls[0].color,'#dddcd0');q.floors[0].openings[0].wallId='missing';assert.throws(()=>M.validateProject(q));});
test('raster wall detection reconstructs an orthogonal plan and suggests a real gap',()=>{const width=700,height=540,pixels=new Uint8ClampedArray(width*height*4);pixels.fill(255);const rect=(x,y,w,h)=>{for(let Y=y;Y<y+h;Y++)for(let X=x;X<x+w;X++){const n=(Y*width+X)*4;pixels[n]=pixels[n+1]=pixels[n+2]=0;}};rect(50,50,600,12);rect(50,50,12,440);rect(638,50,12,440);rect(50,478,260,12);rect(390,478,260,12);rect(340,50,12,428);const out=detectRaster(pixels,width,height,{pixelsPerMeter:60,minPixels:70,inferOpenings:true});assert.ok(out.walls.length>=4);assert.ok(out.openings.length>=1);assert.ok(out.openings.every(o=>out.walls.some(w=>w.id===o.wallId)));assert.ok(out.walls.every(w=>w.thickness>=.07&&w.thickness<=.6));});
