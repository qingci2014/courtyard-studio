import {decodeDxf,parseCAD} from './cad.js';
import {createCADProcessor} from './cad-processing.js';
const process=createCADProcessor(bytes=>parseCAD(decodeDxf(bytes)));
self.onmessage=async({data})=>{try{self.postMessage({id:data.id,result:await process(data)});}catch(error){self.postMessage({id:data.id,error:error.message||'无法读取 DXF 图纸。'});}};
