import {afterEach,expect,it,vi} from 'vitest';
import {gzipSync} from 'node:zlib';
import {loadCockpitModel} from '../app/moon-cockpit-loading';
import {loadPackedModel} from '../app/moon-model-loading';

// A real GLB fixture exercises download, decompression and GLTFLoader parsing.
const json=Buffer.from(JSON.stringify({asset:{version:'2.0'},scenes:[{nodes:[0]}],scene:0,nodes:[{name:'LandingLadder',translation:[22,1.78,24],extras:{boarding:true}}]}));
const body=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,0x20)]);
const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+body.length,8);header.writeUInt32LE(body.length,12);header.writeUInt32LE(0x4e4f534a,16);
const glb=Buffer.concat([header,body]),packed=gzipSync(glb);
const response=(data:Uint8Array)=>new Response(data,{headers:{'Content-Length':String(data.length)}});
afterEach(()=>{vi.unstubAllGlobals();});

it('downloads and decompresses the smaller asset, then parses the original scene data',async()=>{
 const fetch=vi.fn(async()=>response(packed));vi.stubGlobal('fetch',fetch);
 const report=vi.fn(),signal=new AbortController().signal;
 const model=await loadCockpitModel('/moon/content/cockpit-packed.bin?v=1','/moon/content/cockpit.glb?v=1',signal,report);
 expect(fetch).toHaveBeenCalledTimes(1);expect(fetch).toHaveBeenCalledWith('/moon/content/cockpit-packed.bin?v=1',{signal});
 const ladder=model.scene.getObjectByName('LandingLadder');
 expect(ladder?.position.toArray()).toEqual([22,1.78,24]);expect(ladder?.userData.boarding).toBe(true);
 expect(report).toHaveBeenCalledWith('正在解压驾驶舱模型…');
 expect(report.mock.calls.some(([text])=>text.includes('正在下载驾驶舱模型')&&text.includes('MB'))).toBe(true);
});

it('uses the regular GLB when browser decompression is unavailable',async()=>{
 vi.stubGlobal('DecompressionStream',undefined);const fetch=vi.fn(async()=>response(glb));vi.stubGlobal('fetch',fetch);
 const model=await loadCockpitModel('/packed','/cockpit.glb',new AbortController().signal,()=>{});
 expect(model.scene.children).toHaveLength(1);expect(fetch.mock.calls[0][0]).toBe('/cockpit.glb');expect(fetch).toHaveBeenCalledTimes(1);
});

it.each(['missing','corrupt'])('recovers from a %s packed asset using the ordinary GLB',async failure=>{
 const fetch=vi.fn().mockResolvedValueOnce(failure==='missing'?new Response(null,{status:404}):response(new Uint8Array([1,2,3]))).mockResolvedValueOnce(response(glb));vi.stubGlobal('fetch',fetch);
 const model=await loadCockpitModel('/packed','/cockpit.glb',new AbortController().signal,()=>{});
 expect(model.scene.children).toHaveLength(1);expect(fetch.mock.calls.map(call=>call[0])).toEqual(['/packed','/cockpit.glb']);
});

it('does not start a second large request after the visitor leaves the page',async()=>{
 const abort=new AbortController();const fetch=vi.fn(async()=>{abort.abort();throw abort.signal.reason;});vi.stubGlobal('fetch',fetch);
 await expect(loadCockpitModel('/packed','/cockpit.glb',abort.signal,()=>{})).rejects.toMatchObject({name:'AbortError'});
 expect(fetch).toHaveBeenCalledTimes(1);
});

it('reports a failed fallback instead of claiming that the cockpit loaded',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(null,{status:503})));
 await expect(loadCockpitModel('/packed','/cockpit.glb',new AbortController().signal,()=>{})).rejects.toThrow('驾驶舱模型下载失败 (503)');
});

it('keeps the existing base loader progress and payload unchanged',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>response(packed)));const report=vi.fn();
 const result=await loadPackedModel('/base-packed.bin',new AbortController().signal,report);
 expect(Buffer.from(result).equals(glb)).toBe(true);expect(report).toHaveBeenCalledWith('正在解析基地模型…');
});
