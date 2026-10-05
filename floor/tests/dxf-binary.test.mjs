import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeDxf,parseCAD,prepareCAD} from '../src/cad.js';
import {decodeBinaryDxf} from '../src/dxf-binary.js';

// Independent fixtures specify each value's wire type rather than using the decoder's type table.
function file(groups,legacy=false){
 const out=[Buffer.from('AutoCAD Binary DXF\r\n\x1a\0','ascii')];
 for(const [code,type,value] of groups){
  if(legacy&&code<255)out.push(Buffer.from([code]));
  else {const b=Buffer.alloc(legacy?3:2);if(legacy)b[0]=255;b.writeUInt16LE(code,legacy?1:0);out.push(b);}
  if(type==='s')out.push(Buffer.from(value,'utf8'),Buffer.from([0]));
  else if(type==='bytes')out.push(Buffer.from(value),Buffer.from([0]));
  else if(type==='chunk')out.push(Buffer.from([value.length,...value]));
  else {const b=Buffer.alloc({i16:2,i32:4,i64:8,f64:8,u8:1}[type]);b[{i16:'writeInt16LE',i32:'writeInt32LE',i64:'writeBigInt64LE',f64:'writeDoubleLE',u8:'writeUInt8'}[type]](value);out.push(b);}
 }
 return Buffer.concat(out);
}
const head=version=>[[0,'s','SECTION'],[2,'s','HEADER'],[9,'s','$ACADVER'],[1,'s',version],[9,'s','$INSUNITS'],[70,'i16',4]];
const section=[[0,'s','ENDSEC'],[0,'s','SECTION'],[2,'s','ENTITIES']];
const line=[[0,'s','LINE'],[8,'s','墙体'],[10,'f64',1000],[20,'f64',2000],[11,'f64',6000],[21,'f64',2000]];
const end=[[0,'s','ENDSEC'],[0,'s','EOF']];
test('binary UTF-8 Chinese layers and millimetre coordinates produce a five metre wall',()=>{
 const raw=parseCAD(decodeDxf(file([...head('AC1032'),...section,...line,...end])));
 assert.equal(raw.layers[0].name,'墙体');assert.equal(raw.unit,'mm');
 const model=prepareCAD(raw,{unit:'mm',layers:['墙体'],mode:'center'});assert.equal(model.walls.length,1);assert.equal(model.bounds.w,5);
});
test('legacy binary group codes and extended data escape retain their values',()=>{
 const source=[...head('AC1009'),...section,...line.map(([c,t,v])=>[c,t,c===8?'WALL':v]),[1001,'s','APP'],[1071,'i32',999999],...end];
 const text=decodeDxf(file(source,true));assert.ok(text.includes('1071\n999999\n'));assert.equal(parseCAD(text).segments.length,1);
});
test('binary DXF respects pre-2007 GBK instead of decoding Chinese layer names as UTF-8',()=>{
 const source=[...head('AC1015'),[9,'s','$DWGCODEPAGE'],[3,'s','ANSI_936'],...section,...line.map(([c,t,v])=>c===8?[c,'bytes',[0xc7,0xbd,0xcc,0xe5]]:[c,t,v]),...end];
 assert.equal(parseCAD(decodeDxf(file(source))).layers[0].name,'墙体');
});
test('binary metadata does not shift following coordinates: int64, booleans, int16 and binary chunks',()=>{
 const source=[...head('AC1032'),[160,'i64',9007199254740993n],[290,'u8',1],[280,'i16',4660],[310,'chunk',[0,128,255]],...section,...line,...end];
 const text=decodeDxf(file(source));assert.ok(text.includes('160\n9007199254740993\n'));assert.ok(text.includes('280\n4660\n'));assert.ok(text.includes('310\n0080ff\n'));assert.equal(parseCAD(text).segments.length,1);
});
test('malformed binary DXF fails on missing terminators, non-finite coordinates and invalid boolean flags',()=>{
 const valid=file([...head('AC1032'),...section,...line,...end]);
 assert.throws(()=>decodeBinaryDxf(valid.subarray(0,valid.length-1)),/不完整/);
 assert.throws(()=>decodeDxf(file([...head('AC1032'),[290,'u8',2],...section,...line,...end])),/布尔/);
 assert.throws(()=>decodeDxf(file([...head('AC1032'),...section,...line.map(([c,t,v])=>[c,t,c===10?NaN:v]),...end])),/无效数值/);
});
