import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const upstreamRevision='1dd682f46339f37b67c5ff1085d10d04a8c16d7e';
const expectedWasmBlob='d6550b006db6349934e0821307d0853dab424e25';
const wasm=await fs.readFile('node_modules/@mlightcad/libredwg-web/wasm/libredwg-web.wasm');
const blob=createHash('sha1').update(`blob ${wasm.length}\0`).update(wasm).digest('hex');
if(blob!==expectedWasmBlob)throw new Error('DWG reader does not match the pinned corresponding source');
let revision='main';
try{const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();if(/^[0-9a-f]{40}$/.test(head))revision=head;}catch{}
const appSource=`https://github.com/qingci2014/courtyard-studio/tree/${revision}/floor`;
const appArchive=`https://github.com/qingci2014/courtyard-studio/archive/${revision}.zip`;
const upstream=`https://github.com/mlightcad/libredwg-web/tree/${upstreamRevision}`;
await fs.mkdir('public',{recursive:true});
await fs.copyFile('LICENSE','public/license.txt');
await fs.copyFile('SOURCE.md','public/source-info.txt');
await fs.writeFile('public/source.html',`<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>筑间 · 开源许可与源码</title>
<style>body{margin:40px auto;padding:0 24px;max-width:780px;background:#f3f1ed;color:#3f4750;font:16px/1.8 system-ui,sans-serif}a{color:#4e708a}code{overflow-wrap:anywhere}li{margin:12px 0}</style>
<h1>筑间 · 开源许可与源码</h1>
<p>本次发布的 floor 工作台采用 GNU GPL v3，允许在许可条件下使用、修改和再分发，不提供担保。原有 MIT 等第三方版权声明保留；同仓库其他独立应用的许可不在此范围。</p>
<ul><li><a href="license.txt">GNU GPL v3 许可全文</a> · <a href="third-party-licenses.txt">第三方许可与版权声明</a></li>
<li><a href="${appSource}">本次工作台源码和构建说明</a> · <a href="${appArchive}">下载仓库源码 ZIP</a>（工作台在 floor 目录）<br>版本：<code>${revision}</code></li>
<li>DWG 组件：@mlightcad/libredwg-web 0.7.14。<a href="${upstream}">完整 C/C++、JavaScript 源码和构建脚本</a> · <a href="https://github.com/mlightcad/libredwg-web/archive/${upstreamRevision}.zip">下载对应源码 ZIP</a>。<br>固定版本：<code>${upstreamRevision}</code></li>
<li><a href="source-info.txt">构建步骤、子模块与组件校验信息</a></li></ul>
<p>工作台：Node.js 22，进入 floor 后执行 npm ci 和 npm run build -- --base=/floor/。DWG 底层重编译步骤在对应源码的 bindings/javascript/README.md；需安装 Emscripten、Autotools，并按该版本初始化 jsmn 子模块。</p>
<p><a href="./">返回工作台</a></p></html>`);
console.log('Prepared licenses and pinned corresponding-source links.');
