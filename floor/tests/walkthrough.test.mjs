import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as M from '../src/model.js';
import {makeSolid,offsetSolid} from '../src/modeling.js';
import {walkBlocked,findWalkStart} from '../src/walk-navigation.js';
import {prepareWalkthrough,createWalkthroughHTML} from '../src/walkthrough-export.js';

const rectangle=()=>{const f=M.makeFloor();f.walls.push(...[[0,0,6,0],[6,0,6,4],[6,4,0,4],[0,4,0,0]].map(([x,y,a,b])=>M.wall({x,y},{x:a,y:b})));f.rooms=M.detectRooms(f);return f;};
test('standalone export keeps all floors and geometry without modifying the editor project',()=>{
 const p=M.villaProject(),before=M.clone(p);p.floors[0].image={data:'data:image/png;base64,AA==',x:0,y:0,width:10,pixelWidth:10,pixelHeight:10,opacity:.5};const withImage=M.clone(p),data=prepareWalkthrough(p,p.floors[1].id);assert.equal(data.initialFloorId,p.floors[1].id);assert.equal(data.project.floors[0].image,null);assert.deepEqual(data.project.floors.map(f=>f.walls),before.floors.map(f=>f.walls));assert.deepEqual(p,withImage);assert.throws(()=>prepareWalkthrough(M.blankProject()),/请先/);
});
test('project names cannot escape the title or embedded JSON script',()=>{
 const p=M.villaProject();p.name='</script><img src=x onerror=alert(1)>';p.floors[0].rooms[0].name='</script><script>alert(1)</script>';
 const runtime='/* '+'.'.repeat(120)+' */ const text="</script>";',html=createWalkthroughHTML(p,{runtime,licenses:'sample --> trailing'}),scripts=[...html.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,2);assert.equal(JSON.parse(scripts[0][1]).project.name,p.name);assert.ok(html.includes('&lt;/script&gt;'));assert.ok(!html.includes('<img src=x'));new vm.Script(scripts[1][1]);assert.ok(html.includes("connect-src 'none'"));assert.ok(!/<(?:script|link)\b[^>]*(?:src|href)=/i.test(html));
});
test('navigation blocks closed walls, furniture and columns, but allows open doors and hollow bands',()=>{
 const f=rectangle(),w=f.walls[0],door={id:M.uid(),type:'door',wallId:w.id,offset:3,width:1,height:2.1,sill:0};f.openings.push(door);
 assert.equal(walkBlocked({x:3,y:0},f),false);assert.equal(walkBlocked({x:3,y:0},f,{doorStates:new Map([[door.id,false]])}),true);
 f.furniture.push({id:M.uid(),type:'table',x:2,y:2,w:1,d:2,rot:45});assert.equal(walkBlocked({x:2,y:2},f),true);f.furniture[0].hidden=true;assert.equal(walkBlocked({x:2,y:2},f),false);assert.equal(walkBlocked({x:2,y:2},f,{includeHidden:true}),true);
 f.solids.push(offsetSolid([[0,0],[6,0],[6,4],[0,4]],{distance:.2,base:2.5,height:.2}),makeSolid([[4,1],[5,1],[5,2],[4,2]],{height:2.8}));assert.equal(walkBlocked({x:3,y:2},f),false);assert.equal(walkBlocked({x:4.5,y:1.5},f),true);
});
test('room entry finds a free point beside a central obstacle and rejects a fully occupied room',()=>{
 const f=rectangle();f.furniture.push({id:M.uid(),type:'bed',x:3,y:2,w:2,d:2,rot:0});const p=findWalkStart(f,f.rooms[0].id,q=>walkBlocked(q,f));assert.ok(p);assert.ok(M.pointIn(p,f.rooms[0].poly));assert.equal(walkBlocked(p,f),false);
 assert.equal(findWalkStart(f,f.rooms[0].id,()=>true),null);assert.equal(findWalkStart(f,'missing',()=>false),null);
});
test('built walkthrough runtime is one classic script with no editor database or external imports',async()=>{
 await import('../scripts/build-walkthrough.mjs');
 const runtime=fs.readFileSync(new URL('../public/walkthrough-runtime.js',import.meta.url),'utf8');new vm.Script(runtime);assert.ok(runtime.length>100000);assert.ok(!runtime.includes('indexedDB.open'));assert.ok(!/\bimport\s*\(/.test(runtime));assert.ok(!/sourceMappingURL=/.test(runtime));
});
