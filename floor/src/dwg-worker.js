import {readDwg} from './dwg.js';
self.onmessage=async e=>{
 try{self.postMessage({result:await readDwg(e.data,undefined,{onProgress:status=>self.postMessage({status})})});}
 catch(error){self.postMessage({error:error.message||'无法读取 DWG 图纸。'});}
};
