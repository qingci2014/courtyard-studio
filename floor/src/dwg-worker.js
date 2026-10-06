import {readDwg} from './dwg.js';
import {createCADProcessor} from './cad-processing.js';
const process=createCADProcessor(bytes=>readDwg(bytes,undefined,{onProgress:status=>self.postMessage({status})}));
self.onmessage=async({data})=>{try{self.postMessage({id:data.id,result:await process(data)});}catch(error){self.postMessage({id:data.id,error:error.message||'无法读取 DWG 图纸。'});}};
