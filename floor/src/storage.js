const dbPromise=new Promise((resolve,reject)=>{const r=indexedDB.open('zhujian-studio',1);r.onupgradeneeded=()=>r.result.createObjectStore('projects');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
export async function saveProject(project,editorState){const db=await dbPromise;return new Promise((resolve,reject)=>{const tx=db.transaction('projects','readwrite'),store=tx.objectStore('projects');store.put(structuredClone(project),'current');if(editorState)store.put(structuredClone(editorState),'editor-state');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
export async function loadProject(){const db=await dbPromise;return new Promise((resolve,reject)=>{const r=db.transaction('projects').objectStore('projects').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function saveEditorState(state){const db=await dbPromise;return new Promise((resolve,reject)=>{const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put(structuredClone(state),'editor-state');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
export async function loadEditorState(){const db=await dbPromise;return new Promise((resolve,reject)=>{const r=db.transaction('projects').objectStore('projects').get('editor-state');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export {download} from './download.js';
export async function readPlan(file,pageNumber=1){
 if(file.size>30*1024*1024)throw new Error('图纸请控制在 30 MB 以内');
 if(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')){
  const pdfjs=await import('pdfjs-dist');const worker=await import('pdfjs-dist/build/pdf.worker.min.mjs?url');pdfjs.GlobalWorkerOptions.workerSrc=worker.default;
  const resourceBase=new URL(import.meta.env.BASE_URL+'pdfjs/',document.baseURI).href;
  const task=pdfjs.getDocument({data:await file.arrayBuffer(),isEvalSupported:false,cMapUrl:resourceBase+'cmaps/',cMapPacked:true,standardFontDataUrl:resourceBase+'standard_fonts/',wasmUrl:resourceBase+'wasm/',iccUrl:resourceBase+'iccs/'});
  try{const doc=await task.promise;if(!Number.isInteger(pageNumber)||pageNumber<1||pageNumber>doc.numPages)throw new Error(`PDF 共 ${doc.numPages} 页，请选择有效页码`);const page=await doc.getPage(pageNumber),v=page.getViewport({scale:1}),scale=Math.min(2.5,2400/Math.max(v.width,v.height)),viewport=page.getViewport({scale}),cv=document.createElement('canvas');cv.width=Math.ceil(viewport.width);cv.height=Math.ceil(viewport.height);await page.render({canvasContext:cv.getContext('2d'),viewport}).promise;return{data:cv.toDataURL('image/png'),pixelWidth:cv.width,pixelHeight:cv.height,pages:doc.numPages,name:file.name};}finally{await task.destroy();}
 }
 if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('支持 PNG、JPG、WebP 或 PDF 图纸');
 const bitmap=await createImageBitmap(file),scale=Math.min(1,2400/Math.max(bitmap.width,bitmap.height)),cv=document.createElement('canvas');cv.width=Math.round(bitmap.width*scale);cv.height=Math.round(bitmap.height*scale);cv.getContext('2d').drawImage(bitmap,0,0,cv.width,cv.height);bitmap.close();return{data:cv.toDataURL('image/png'),pixelWidth:cv.width,pixelHeight:cv.height,pages:1,name:file.name};
}
