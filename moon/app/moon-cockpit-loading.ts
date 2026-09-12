import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {loadPackedModel} from './moon-model-loading';

export async function loadCockpitModel(packedURL:string,modelURL:string,signal:AbortSignal,report:(text:string)=>void){
 let buffer:ArrayBuffer|undefined;
 signal.throwIfAborted();
 if(typeof DecompressionStream==='function'){
  try{buffer=await loadPackedModel(packedURL,signal,report,'驾驶舱');}
  catch{signal.throwIfAborted();} // Older caches can still serve the ordinary GLB.
 }
 if(!buffer){
  report('正在下载驾驶舱模型…');
  const response=await fetch(modelURL,{signal});
  if(!response.ok)throw Error(`驾驶舱模型下载失败 (${response.status})`);
  buffer=await response.arrayBuffer();
 }
 signal.throwIfAborted();report('正在解析驾驶舱模型…');
 return new GLTFLoader().parseAsync(buffer,new URL('.',new URL(modelURL,globalThis.location?.href??'http://localhost/')).href);
}
