import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {LibreDwg} from '@mlightcad/libredwg-web';
import DxfParser from 'dxf-parser';
import {dwgVersion,readDwg} from '../src/dwg.js';
import {decodeDxf,parseCAD,prepareCAD,applyCAD} from '../src/cad.js';
import {previewCAD} from '../src/cad-processing.js';
import {makeFloor,length,clone} from '../src/model.js';

const fixture=n=>fs.readFile(new URL('./fixtures/dwg/'+n,import.meta.url));
const base=fileURLToPath(new URL('../node_modules/@mlightcad/libredwg-web/wasm',import.meta.url));
let reader;
test.before(async()=>{reader=await LibreDwg.create(base);});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('real DWG 2000, 2010 and 2018 preserve CAD coordinates, units and polyline vertices',async()=>{
 for(const [name,version,count] of [['line-2000.dwg','2000',1],['line-2010.dwg','2010',1],['polyline-2018.dwg','2018',4]]){
  const buffer=await fixture(name),progress=[],raw=await readDwg(buffer,base,{decoder:reader,onProgress:x=>progress.push(x)});
  assert.equal(raw.format,'DWG');assert.equal(raw.version,version);assert.equal(raw.unit,'in');assert.equal(raw.segments.length,count);assert.ok(progress.length);
  const result=prepareCAD(raw,{unit:raw.unit,layers:['0'],mode:'center',inferDoors:false,thickness:.05});
  assert.equal(result.walls.length,count);near(result.bounds.w,raw.bounds.w*.0254);near(result.bounds.h,raw.bounds.h*.0254);
  const sourceLengths=raw.segments.map(s=>Math.hypot(s.b.x-s.a.x,s.b.y-s.a.y)*.0254).sort((a,b)=>a-b);
  result.walls.map(length).sort((a,b)=>a-b).forEach((v,i)=>near(v,sourceLengths[i]));
  const floor=makeFloor(),before=clone(floor);applyCAD(floor,result,{name});assert.equal(floor.walls.length,count);assert.equal(floor.cad.name,name);assert.equal(before.walls.length,0);
 }
});
test('DWG rejects renamed files, empty/truncated data, unsupported signatures and oversize inputs before loading the decoder',async()=>{
 assert.throws(()=>dwgVersion(new Uint8Array()),/为空/);
 assert.throws(()=>dwgVersion(new TextEncoder().encode('0\nSECTION\n')),/不是有效/);
 assert.throws(()=>dwgVersion(new TextEncoder().encode('AC1009')),/版本暂不支持/);
 assert.throws(()=>dwgVersion(new TextEncoder().encode('AC1032')),/不完整/);
 assert.throws(()=>dwgVersion(new Uint8Array(30*1024*1024+1)),/30 MB/);
 await assert.rejects(readDwg(new Uint8Array(),base),/为空/);
});
test('DWG conversion failures are readable and a complex drawing opens a bounded preview without altering a floor',async()=>{
 const valid=await fixture('line-2000.dwg');
 await assert.rejects(readDwg(valid,base,{decoder:{dwg_write_dxf:()=>null}}),/无法读取此 DWG/);
 await assert.rejects(readDwg(valid,base,{decoder:{dwg_write_dxf:()=>{throw Error('native');}}}),/无法读取此 DWG/);
 const floor=makeFloor(),before=clone(floor);
 const raw=await readDwg(await fixture('blocks-2018.dwg'),base,{decoder:reader});
 assert.ok(raw.segments.length>24000);const preview=previewCAD(raw,{layers:raw.layers.map(l=>l.name)});assert.ok(preview.segments.length<=6000);assert.equal(preview.total,raw.segments.length);assert.deepEqual(preview.bounds,raw.bounds);
 assert.deepEqual(floor,before);
});
test('real binary DXF 2000 and 2018 decode with their headers, units and layers',async()=>{
 const old=new DxfParser().parseSync(decodeDxf(await fixture('example-2000-binary.dxf')));
 assert.equal(old.header.$ACADVER,'AC1015');assert.equal(old.header.$INSUNITS,4);assert.equal(old.entities.length,54);
 const raw=parseCAD(decodeDxf(await fixture('example-2018-binary.dxf')));assert.equal(raw.unit,'mm');assert.equal(raw.segments.length,1227);assert.deepEqual(raw.layers.map(x=>x.name),['Tavolo 3','Tavolo 2']);
});
test('shared LINE and LWPOLYLINE entities preserve geometry across upstream ASCII and binary exports',async()=>{
 const parser=new DxfParser(),ascii=parser.parseSync(decodeDxf(await fixture('example-2018-ascii.dxf'))),binary=parser.parseSync(decodeDxf(await fixture('example-2018-binary.dxf')));
 const byHandle=new Map(ascii.entities.map(e=>[e.handle,e]));let checked=0;
 for(const b of binary.entities.filter(e=>['LINE','LWPOLYLINE'].includes(e.type))){
  const a=byHandle.get(b.handle);if(!a)continue;
  assert.equal(b.type,a.type);assert.equal(b.layer,a.layer);assert.equal(b.vertices.length,a.vertices.length);
  b.vertices.forEach((v,i)=>{near(v.x,a.vertices[i].x);near(v.y,a.vertices[i].y);near(v.bulge||0,a.vertices[i].bulge||0);});checked++;
 }
 assert.ok(checked>=4);
});
test('binary DXF truncated records and unknown group types fail explicitly',async()=>{
 const bytes=await fixture('example-2018-binary.dxf');
 assert.throws(()=>decodeDxf(bytes.subarray(0,bytes.length-6)),/二进制 DXF/);
 const bad=new Uint8Array(bytes);bad[22]=0xff;bad[23]=0x7f;assert.throws(()=>decodeDxf(bad),/组码/);
});
