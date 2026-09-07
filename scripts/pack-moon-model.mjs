import {readFile,writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
const input=new URL('../moon/public/content/base.glb',import.meta.url);
const raw=await readFile(input),packed=gzipSync(raw,{level:9});
await writeFile(new URL('../moon/public/content/base-packed.bin',import.meta.url),packed);
console.log(`Base transfer: ${raw.length} -> ${packed.length} bytes`);
