import {decodeDxf,parseCAD} from './cad.js';
self.onmessage=e=>{try{self.postMessage({result:parseCAD(decodeDxf(e.data))});}catch(error){self.postMessage({error:error.message||'无法读取 DXF 图纸。'});}};
