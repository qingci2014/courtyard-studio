/** Transport compression is lossless; no geometry, UVs or metadata are changed. */
export async function loadPackedModel(url:string,signal:AbortSignal,report:(text:string)=>void,label='基地'){
 report(`正在下载${label}模型…`);
 const response=await fetch(url,{signal});if(!response.ok)throw Error(`${label}模型下载失败`);
 const total=Number(response.headers.get('content-length'))||0;
 const reader=response.body?.getReader();const chunks:Uint8Array[]=[];let received=0;
 if(reader){while(true){const {value,done}=await reader.read();if(done)break;chunks.push(value);received+=value.byteLength;report(`正在下载${label}模型 ${(received/1048576).toFixed(1)}${total?' / '+(total/1048576).toFixed(1):''} MB…`);}}
 else{chunks.push(new Uint8Array(await response.arrayBuffer()));}
 report(`正在解压${label}模型…`);
 const packed=new Blob(chunks as BlobPart[]);const buffer=await new Response(packed.stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
 signal.throwIfAborted();report(`正在解析${label}模型…`);await new Promise(resolve=>setTimeout(resolve,0));return buffer;
}
