import test from 'node:test';
import assert from 'node:assert/strict';
import {detectRaster} from '../src/recognition.js';
import {makeFloor,detectRooms,validateProject,blankProject,applyRecognition,wall,clone} from '../src/model.js';
import {planFixture,wallMetrics} from './fixtures/recognition-plans.mjs';

for(const style of ['solid','outline'])for(const scale of [.65,1,1.5])for(const grey of [0,175]){
 test('wall network survives '+[style,scale,grey].join('/'),()=>{
  const f=planFixture({style,scale,grey,background:grey?245:255,variant:scale===1?1:2,mirror:scale<1});
  const r=detectRaster(f.pixels,f.width,f.height,{pixelsPerMeter:f.ppm});
  const metrics=wallMetrics(r,f);
  assert.ok(metrics.coverage>.92,JSON.stringify(metrics));
  assert.ok(metrics.falseLength<1.5,JSON.stringify(metrics));
  assert.ok(r.openings.some(o=>o.type==='door'),'door gap should remain an opening');
  const floor=makeFloor();floor.walls=r.walls;floor.openings=r.openings;floor.rooms=detectRooms(floor);
  assert.ok(floor.rooms.length>=3,'closed building partitions should form rooms');
  const p=blankProject();p.floors=[floor];validateProject(p);
 });
}
test('blank and isolated furniture-like hairline rectangles do not become confident walls',()=>{
 const w=400,h=300,p=new Uint8ClampedArray(w*h*4);p.fill(255);
 const line=(x,y,W,H)=>{for(let j=y;j<y+H;j++)for(let i=x;i<x+W;i++){const k=(j*w+i)*4;p[k]=p[k+1]=p[k+2]=0;}};
 const draw=(x,y,W,H)=>{line(x,y,W,1);line(x,y+H,W,1);line(x,y,1,H);line(x+W,y,1,H);};
 assert.equal(detectRaster(p,w,h).walls.length,0);
 draw(80,70,180,100);draw(84,74,172,92);
 assert.equal(detectRaster(p,w,h,{pixelsPerMeter:80}).walls.length,0);
});
for(const scale of [.75,1.4])test('multi-line windows and scan breaks retain the wall network at scale '+scale,()=>{
 const fixture=planFixture({scale,windows:true,breaks:true}),r=detectRaster(fixture.pixels,fixture.width,fixture.height,{pixelsPerMeter:fixture.ppm});
 assert.ok(wallMetrics(r,fixture).coverage>.94);
 assert.ok(r.openings.some(o=>o.type==='window'));
 const top=r.walls.filter(w=>w.structuralKind!=='column'&&Math.abs(w.a.y-70/80)<.25&&Math.abs(w.b.y-w.a.y)<.01);
 assert.ok(top.reduce((sum,w)=>sum+Math.hypot(w.b.x-w.a.x,w.b.y-w.a.y),0)<11.5,'window frames should not become duplicate walls');
});
test('L-shaped wall network closes with a concave corner',()=>{
 const width=740,height=650,pixels=new Uint8ClampedArray(width*height*4);pixels.fill(255);
 const rect=(x,y,w,h)=>{for(let Y=y;Y<y+h;Y++)for(let X=x;X<x+w;X++){const i=(Y*width+X)*4;pixels[i]=pixels[i+1]=pixels[i+2]=0;}};
 const lines=[[60,60,650,60],[650,60,650,315],[650,315,405,315],[405,315,405,580],[405,580,60,580],[60,580,60,60],[60,315,405,315]];
 for(const [x1,y1,x2,y2] of lines){const x=Math.min(x1,x2)-8,y=Math.min(y1,y2)-8,w=Math.abs(x2-x1)+16,h=Math.abs(y2-y1)+16;rect(x,y,w,1);rect(x,y+h-1,w,1);rect(x,y,1,h);rect(x+w-1,y,1,h);}
 const r=detectRaster(pixels,width,height,{pixelsPerMeter:70}),f=makeFloor();f.walls=r.walls;
 assert.equal(detectRooms(f).length,2);assert.equal(r.walls.length,6,'collinear sections share one wall across a T junction');
});
test('disabling opening inference suppresses both doors and multi-line windows',()=>{
 const f=planFixture({windows:true}),r=detectRaster(f.pixels,f.width,f.height,{pixelsPerMeter:f.ppm,inferOpenings:false});
 assert.equal(r.openings.length,0);assert.ok(r.walls.length>=7);
});
test('re-running replaces only automatic walls and their openings, preserving authored objects',()=>{
 const f=makeFloor(),manual=wall({x:20,y:0},{x:25,y:0}),auto={...wall({x:0,y:0},{x:4,y:0}),inferred:true};
 f.walls=[manual,auto];
 const door=(wallId)=>({id:crypto.randomUUID(),wallId,type:'door',offset:2,width:.8,height:2.1,sill:0});
 const oldDoor=door(auto.id),manualDoor=door(manual.id);f.openings=[oldDoor,manualDoor];
 f.image={name:'unchanged.png',width:15};f.furniture=[{id:'chair',x:7,y:9}];f.stairs=[{id:'stair',x:8,y:9}];
 const before=clone(f),fixture=planFixture(),result=detectRaster(fixture.pixels,fixture.width,fixture.height,{pixelsPerMeter:fixture.ppm});
 applyRecognition(f,result);const ids=f.walls.map(w=>w.id);
 applyRecognition(f,result);assert.deepEqual(f.walls.map(w=>w.id),ids);
 assert.equal(f.walls.length,result.walls.length+1);assert.deepEqual(f.walls[0],manual);
 assert.ok(f.openings.some(o=>o.id===manualDoor.id));assert.ok(!f.openings.some(o=>o.id===oldDoor.id));
 for(const key of ['image','furniture','stairs'])assert.deepEqual(f[key],before[key]);
});
test('preview choices gate walls and their openings, and an empty selection cannot remove the model',()=>{
 const f=makeFloor(),original={...wall({x:0,y:0},{x:5,y:0}),inferred:true};f.walls=[original];
 const a={...wall({x:1,y:1},{x:5,y:1}),inferred:true},b={...wall({x:1,y:2},{x:5,y:2}),inferred:true};
 const op={id:crypto.randomUUID(),wallId:a.id,type:'door',offset:2,width:.8,height:2.1,sill:0};
 const result={walls:[a],reviewWalls:[b],openings:[op]},before=clone(f);
 assert.throws(()=>applyRecognition(f,result,{selectedIds:[]}));assert.deepEqual(f,before);
 applyRecognition(f,result,{selectedIds:[b.id]});assert.deepEqual(f.walls,[b]);assert.equal(f.openings.length,0);
 applyRecognition(f,result,{selectedIds:[a.id],mode:'append'});assert.equal(f.walls.length,2);assert.equal(f.openings.length,1);
 applyRecognition(f,result,{selectedIds:[a.id],mode:'append'});assert.equal(f.walls.length,2);assert.equal(f.openings.length,1);
});
