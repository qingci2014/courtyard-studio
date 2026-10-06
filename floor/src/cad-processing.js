import {cadBounds,clipCADSegment,prepareCAD} from './cad.js';

export const CAD_PREVIEW_LIMIT=6000;
export function restoreCADReference(reference){
 if(!reference?.segments?.length||reference.segments.length>12000)throw new Error('没有可用的 CAD 参考线，请重新导入图纸。');
 const layers=new Map(),segments=reference.segments.map(s=>{
  if(!s||![s.a?.x,s.a?.y,s.b?.x,s.b?.y].every(Number.isFinite))throw new Error('CAD 参考线坐标无效。');
  const layer=typeof s.layer==='string'?s.layer:'CAD 墙线',width=Number.isFinite(s.width)&&s.width>=0?s.width:0,curve=!!s.curve;
  if(!layers.has(layer))layers.set(layer,{name:layer,count:0,straightCount:0,visible:true,recommended:true});
  const info=layers.get(layer);info.count++;if(!curve)info.straightCount++;
  return {a:{...s.a},b:{...s.b},layer,width,curve};
 });
 const settings=reference.modeling||{};
 return {segments,layers:[...layers.values()],bounds:cadBounds(segments),unit:'m',warnings:[],ignored:0,modeling:{mode:settings.mode==='center'?'center':'double',thickness:Number.isFinite(settings.thickness)&&settings.thickness>=.03&&settings.thickness<=1.2?settings.thickness:.2,inferDoors:settings.inferDoors!==false}};
}
export function previewCAD(raw,{layers,crop=null}={}){
 const chosen=new Set(layers),source=raw.segments.filter(s=>chosen.has(s.layer)).map(s=>clipCADSegment(s,crop)).filter(Boolean);
 const stride=Math.max(1,Math.ceil(source.length/CAD_PREVIEW_LIMIT));
 return {segments:source.filter((_,i)=>i%stride===0).slice(0,CAD_PREVIEW_LIMIT),bounds:cadBounds(source),total:source.length,simplified:source.length>CAD_PREVIEW_LIMIT};
}
// The complete drawing stays in its worker. Main-thread previews are bounded;
// analysis always reselects the complete source, never the sampled preview.
export function createCADProcessor(read){
 let raw=null;
 return async message=>{
  if(message.type==='read'||message.type==='reference'){
   raw=message.type==='reference'?restoreCADReference(message.options):await read(message.bytes);
   const {segments,...metadata}=raw;
   return {...metadata,totalSegments:segments.length};
  }
  if(!raw)throw new Error('图纸尚未读取，请重新导入。');
  if(message.type==='preview')return previewCAD(raw,message.options);
  if(message.type==='analyze')return prepareCAD(raw,message.options);
  throw new Error('未知的 CAD 操作。');
 };
}
