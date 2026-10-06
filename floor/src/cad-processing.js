import {cadBounds,clipCADSegment,prepareCAD} from './cad.js';

export const CAD_PREVIEW_LIMIT=6000;
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
  if(message.type==='read'){
   raw=await read(message.bytes);
   const {segments,...metadata}=raw;
   return {...metadata,totalSegments:segments.length};
  }
  if(!raw)throw new Error('图纸尚未读取，请重新导入。');
  if(message.type==='preview')return previewCAD(raw,message.options);
  if(message.type==='analyze')return prepareCAD(raw,message.options);
  throw new Error('未知的 CAD 操作。');
 };
}
