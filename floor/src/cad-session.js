// Own one worker per open import dialog and retire all outstanding requests on
// close, timeout or a worker crash. Response IDs prevent stale option results.
export function createCADSession(worker,{onProgress=()=>{}}={}){
 let id=0,closed=false;const pending=new Map();
 const close=(reason='图纸导入已取消。')=>{if(closed)return;closed=true;worker.terminate();for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error(reason));}pending.clear();};
 worker.onmessage=({data})=>{
  if(closed)return;if(data.status){onProgress(data.status);return;}
  const p=pending.get(data.id);if(!p)return;pending.delete(data.id);clearTimeout(p.timer);data.error?p.reject(new Error(data.error)):p.resolve(data.result);
 };
 worker.onerror=()=>close('CAD 后台处理失败，请重新导入。');
 return {close,request(type,options,{timeout=60000,bytes}={}){
  if(closed)return Promise.reject(new Error('图纸导入已取消。'));
  const requestId=++id;
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>close('CAD 处理超时，请缩小范围后重新导入。'),timeout);pending.set(requestId,{resolve,reject,timer});
   try{worker.postMessage({id:requestId,type,options,bytes},bytes?[bytes]:[]);}catch(error){pending.delete(requestId);clearTimeout(timer);reject(error);close();}
  });
 }};
}
