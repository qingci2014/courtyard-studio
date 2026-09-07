import {interpretMoon} from '../../../moon/app/moon-model-command';
import {ModelError,type ModelConfig} from '../../../moon/app/model-command';
const config=(e:Record<string,unknown>):ModelConfig=>{return {key:e.WORKSHOP_MODEL_ENABLED==='true'&&typeof e.WORKSHOP_MODEL_KEY==='string'?e.WORKSHOP_MODEL_KEY:undefined,baseUrl:typeof e.WORKSHOP_MODEL_BASE_URL==='string'?e.WORKSHOP_MODEL_BASE_URL:undefined,model:typeof e.WORKSHOP_MODEL==='string'?e.WORKSHOP_MODEL:undefined};};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export function onRequestGet({env}:{env:Record<string,unknown>}){const c=config(env);return json({configured:!!(c.key&&c.baseUrl&&c.model),provider:'DeepSeek',model:c.model??null});}
export async function onRequestPost({request,env}:{request:Request;env:Record<string,unknown>}){
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'请求来源无效。'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'请发送 JSON 指令。'},415);
 const reader=request.body?.getReader();if(!reader)return json({error:'缺少指令。'},400);
 let length=0;const chunks:Uint8Array[]=[];try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>8192){await reader.cancel();return json({error:'指令过长。'},413);}chunks.push(value);}}catch{return json({error:'读取指令失败。'},400);}
 const raw=new Uint8Array(length);let offset=0;for(const c of chunks){raw.set(c,offset);offset+=c.length;}let input;try{input=JSON.parse(new TextDecoder().decode(raw));}catch{return json({error:'指令格式不正确。'},400);}
 try{return json(await interpretMoon(input,config(env)));}catch(e){return json({error:e instanceof ModelError?e.message:'服务暂时不可用，未执行任何动作。'},e instanceof ModelError?e.status:500);}
}


