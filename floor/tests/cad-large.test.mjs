import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCAD,prepareCAD} from '../src/cad.js';
import {previewCAD,createCADProcessor} from '../src/cad-processing.js';
import {createCADSession} from '../src/cad-session.js';
import {dxf,line,doublePlan} from './fixtures/cad-plans.mjs';
const options={unit:'mm',layers:['A-WALL'],inferDoors:false};

test('large drawings open before selecting layers, and analysis retains walls outside the sampled preview',async()=>{
 const raw=parseCAD(dxf(line([0,0],[1000,0]).repeat(25000)+doublePlan()));
 assert.ok(raw.segments.length>24000);
 const processor=createCADProcessor(async()=>raw),metadata=await processor({type:'read'});
 assert.equal(metadata.totalSegments,raw.segments.length);assert.equal(metadata.segments,undefined);
 const preview=await processor({type:'preview',options});assert.ok(preview.segments.length<=6000);assert.deepEqual(preview.bounds,{x:0,y:-8000,w:12000,h:8000});
 assert.ok(!preview.segments.some(s=>s.a.x===200&&s.b.x===200));
 const result=await processor({type:'analyze',options});assert.equal(result.walls.length,4);assert.equal(result.referenceSimplified,true);assert.ok(result.reference.length<=12000);
});

test('decorative curves are bounded only in the reference, while all exact walls and full bounds remain',()=>{
 const raw=parseCAD(dxf(doublePlan())),curve={a:{x:0,y:0},b:{x:100,y:50},layer:'A-WALL',curve:true,width:0};
 raw.segments.push(...Array.from({length:26000},()=>curve));
 const result=prepareCAD(raw,options);assert.equal(result.walls.length,4);assert.equal(result.curves,26000);assert.ok(result.reference.length<=12000);assert.equal(result.sourceCount,26008);
 assert.equal(result.reference.filter(s=>!s.curve).length,8);
});

test('a large plan can be narrowed after a recoverable analysis limit, and cropped bounds are exact',async()=>{
 const raw=parseCAD(dxf(doublePlan()+Array.from({length:2600},(_,i)=>line([30000+i*100,0],[30000+i*100,1000])).join('')));
 const process=createCADProcessor(async()=>raw);await process({type:'read'});
 await assert.rejects(process({type:'analyze',options}),/2500/);
 const narrowed={...options,crop:{x:-1,y:-8001,w:12002,h:8002}};
 const result=await process({type:'analyze',options:narrowed});assert.equal(result.walls.length,4);assert.deepEqual(result.bounds,{x:0,y:0,w:12,h:8});
});

test('sampled preview bounds include unsampled outliers',()=>{
 const s={a:{x:0,y:0},b:{x:10,y:1},layer:'A-WALL'},raw={segments:Array.from({length:12002},()=>s)};
 raw.segments[12001]={...s,b:{x:200,y:100}};
 const p=previewCAD(raw,{layers:['A-WALL']});assert.ok(!p.segments.includes(raw.segments[12001]));assert.deepEqual(p.bounds,{x:0,y:0,w:200,h:100});
});

class WorkerStub{messages=[];terminated=false;postMessage(message){this.messages.push(message);}terminate(){this.terminated=true;}reply(i,result){this.onmessage({data:{id:this.messages[i].id,result}});}}
test('worker sessions route out-of-order replies and survive a recoverable analysis error',async()=>{
 const w=new WorkerStub(),s=createCADSession(w),a=s.request('preview',{}),b=s.request('analyze',{});
 w.reply(1,'model');w.reply(0,'preview');assert.equal(await a,'preview');assert.equal(await b,'model');
 const bad=s.request('analyze',{});w.onmessage({data:{id:w.messages[2].id,error:'选择范围过大'}});await assert.rejects(bad,/范围/);
 const retry=s.request('preview',{});w.reply(3,'narrowed');assert.equal(await retry,'narrowed');s.close();
});
test('closing or timing out an import terminates work and rejects every outstanding request',async()=>{
 const w=new WorkerStub(),s=createCADSession(w),a=s.request('read'),b=s.request('preview');
 const checks=[assert.rejects(a,/取消/),assert.rejects(b,/取消/)];s.close();await Promise.all(checks);assert.equal(w.terminated,true);await assert.rejects(s.request('analyze'),/取消/);
 const slow=new WorkerStub(),session=createCADSession(slow);await assert.rejects(session.request('read',{}, {timeout:5}),/超时/);assert.equal(slow.terminated,true);
});
