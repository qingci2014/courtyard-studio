import {LibreDwg} from '@mlightcad/libredwg-web';
import {decodeDxf,parseCAD} from './cad.js';

const VERSIONS={AC1012:'R13',AC1014:'R14',AC1015:'2000',AC1018:'2004',AC1021:'2007',AC1024:'2010',AC1027:'2013',AC1032:'2018'};
export function dwgVersion(buffer){
 const bytes=new Uint8Array(buffer);
 if(!bytes.length)throw new Error('DWG 文件为空。');
 if(bytes.length>30*1024*1024)throw new Error('DWG 请控制在 30 MB 以内。');
 const signature=new TextDecoder('ascii').decode(bytes.subarray(0,6));
 if(!/^AC\d{4}$/.test(signature))throw new Error('文件内容不是有效的 DWG，请检查文件是否损坏或仅修改了扩展名。');
 if(!VERSIONS[signature])throw new Error('此 DWG 版本暂不支持，请在 CAD 中另存为 2000–2018 格式后重试。');
 if(bytes.length<100)throw new Error('DWG 文件不完整，请重新保存图纸。');
 return VERSIONS[signature];
}
export async function readDwg(buffer,wasmBase,{onProgress=()=>{},decoder}={}){
 const version=dwgVersion(buffer);
 onProgress('正在加载 DWG 读取器…');
 let reader;try{reader=decoder||await LibreDwg.create(wasmBase?.replace(/\/$/,''));}
 catch{throw new Error('DWG 读取器加载失败，请刷新页面后重试。');}
 onProgress('正在读取 DWG 图层和线条…');
 let converted;try{converted=reader.dwg_write_dxf(buffer);}
 catch{throw new Error('无法读取此 DWG，请检查文件是否损坏，或在 CAD 中重新保存后重试。');}
 if(!converted?.length)throw new Error('无法读取此 DWG，请在 CAD 中重新保存后重试；复杂代理构件可能需要先炸开。');
 if(converted.length>30*1024*1024)throw new Error('DWG 展开后的数据超过 30 MB，请在 CAD 中只保留所需楼层后重试。');
 const raw=parseCAD(decodeDxf(converted));
 return {...raw,format:'DWG',version};
}
