import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import config from '../vite.config.mjs';

test('PDF worker URL uses a JavaScript extension under the production /floor/ prefix',async()=>{
 const result=await build({
  configFile:false,base:'/floor/',logLevel:'silent',
  plugins:[{name:'pdf-worker-fixture',resolveId:id=>id==='virtual:pdf-worker-test'?id:null,
   load:id=>id==='virtual:pdf-worker-test'?"export {default} from 'pdfjs-dist/build/pdf.worker.min.mjs?url';":null}],
  build:{write:false,copyPublicDir:false,minify:false,rollupOptions:{
   input:'virtual:pdf-worker-test',preserveEntrySignatures:'strict',
   output:{assetFileNames:config.build.rollupOptions.output.assetFileNames}
  }}
 });
 const output=result.output,worker=output.find(o=>o.type==='asset'&&o.fileName.includes('pdf.worker.min-'));
 assert.ok(worker,'real PDF.js worker must be emitted');
 assert.match(worker.fileName,/^assets\/pdf\.worker\.min-[\w-]+\.js$/);
 assert.ok(worker.source.length>100000,'must contain the worker, not an HTML fallback');
 assert.ok(output.some(o=>o.type==='chunk'&&o.code.includes('/floor/'+worker.fileName)));
 assert.ok(!output.some(o=>o.fileName.endsWith('.mjs')));
});
