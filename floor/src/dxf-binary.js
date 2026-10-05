// Autodesk Binary DXF: little-endian group/value pairs after the 22-byte sentinel.
// https://help.autodesk.com/cloudhelp/2025/ENU/AutoCAD-DXF/files/GUID-FC1C3C69-DBC2-49E4-893A-000D6538C0FE.htm
const SENTINEL='AutoCAD Binary DXF\r\n\x1a\0';
const between=(n,a,b)=>n>=a&&n<=b;
export function binaryDxfType(code){
 if(between(code,0,9)||between(code,100,102)||code===105||between(code,300,309)||between(code,320,369)||between(code,390,399)||between(code,410,419)||between(code,430,439)||between(code,470,481)||code===999||between(code,1000,1003)||code===1005)return 'string';
 if(between(code,10,59)||between(code,110,149)||between(code,210,239)||between(code,460,469)||between(code,1010,1059))return 'double';
 if(between(code,60,79)||between(code,170,179)||between(code,270,289)||between(code,370,389)||between(code,400,409)||code===1070)return 'short';
 if(between(code,90,99)||between(code,420,429)||between(code,440,459)||code===1071)return 'int';
 if(between(code,160,169))return 'long';
 if(between(code,290,299))return 'bool';
 if(between(code,310,319)||code===1004)return 'binary';
 throw new Error(`二进制 DXF 含有无法识别的组码 ${code}。`);
}
export function decodeBinaryDxf(buffer){
 const bytes=new Uint8Array(buffer),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(bytes.length>30*1024*1024)throw new Error('DXF 请控制在 30 MB 以内。');
 if(bytes.length<24||!Array.from(SENTINEL).every((c,i)=>bytes[i]===c.charCodeAt(0)))throw new Error('二进制 DXF 文件头不完整。');
 const wide=bytes[23]===0,out=[];let pos=22,header='',modern=false,decoder=new TextDecoder('windows-1252'),chars=0,eof=false;
 const need=n=>{if(pos+n>bytes.length)throw new Error('二进制 DXF 文件不完整。');};
 const read=(method,n)=>{need(n);const value=view[method](pos,true);pos+=n;return value;};
 while(pos<bytes.length){
  let code=wide?read('getUint16',2):read('getUint8',1);
  if(!wide&&code===255)code=read('getUint16',2);
  const type=binaryDxfType(code);let value;
  if(type==='string'){
   const start=pos;while(pos<bytes.length&&bytes[pos]!==0)pos++;
   need(1);value=decoder.decode(bytes.subarray(start,pos++));
  }else if(type==='binary'){
   const count=read('getUint8',1);need(count);
   value=Array.from(bytes.subarray(pos,pos+count),x=>x.toString(16).padStart(2,'0')).join('');pos+=count;
  }else if(type==='double')value=read('getFloat64',8);
  else if(type==='short')value=read('getInt16',2);
  else if(type==='int')value=read('getInt32',4);
  else if(type==='long')value=read('getBigInt64',8).toString();
  else {value=read('getUint8',1);if(value>1)throw new Error('二进制 DXF 含有无效布尔值。');}
  if(typeof value==='number'&&!Number.isFinite(value))throw new Error('二进制 DXF 含有无效数值。');
  if(code===9)header=value;
  if(header==='$ACADVER'&&code===1){modern=Number(String(value).slice(2))>=1021;if(modern)decoder=new TextDecoder('utf-8');}
  if(header==='$DWGCODEPAGE'&&code===3&&!modern){const cp=String(value).match(/^ANSI_(\d+)$/)?.[1];decoder=new TextDecoder({936:'gbk',950:'big5',932:'shift_jis',949:'euc-kr',1252:'windows-1252'}[cp]||'windows-1252');}
  const text=String(value).replace(/\r?\n/g,'\\P');out.push(String(code),text);chars+=String(code).length+text.length+2;
  if(chars>30*1024*1024)throw new Error('DXF 展开后的数据超过 30 MB，请拆分楼层后导入。');
  if(code===0&&value==='EOF'){eof=true;break;}
 }
 if(!eof||bytes.subarray(pos).some(x=>x!==0))throw new Error('二进制 DXF 不完整或含有多余数据。');
 return out.join('\n')+'\n';
}
