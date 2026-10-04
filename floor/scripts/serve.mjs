import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const port=Number(process.env.FLOOR_STUDIO_PORT||4178);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.wasm':'application/wasm'};
const server=http.createServer(async(req,res)=>{
 try{const url=new URL(req.url,'http://127.0.0.1');if(url.pathname==='/__floor_studio_health'){res.writeHead(200,{'Content-Type':'application/json'});return res.end('{"app":"floor-studio","version":"0.1.0"}');}
  let relative=decodeURIComponent(url.pathname).replace(/^\/+/,''),target=path.resolve(root,relative||'index.html');
  if(!target.startsWith(path.resolve(root)+path.sep)&&target!==path.resolve(root)){res.writeHead(403);return res.end('Forbidden');}
  if((await fs.stat(target)).isDirectory())target=path.join(target,'index.html');
  const bytes=await fs.readFile(target);res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(bytes);
 }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`筑间已启动：http://127.0.0.1:${port}/`));
server.on('error',e=>{console.error(e.message);process.exitCode=1;});
