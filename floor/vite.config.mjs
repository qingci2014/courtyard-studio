import {defineConfig} from 'vite';
export default defineConfig({
  base:'./',
  build:{
    target:'es2022',
    rollupOptions:{output:{
      manualChunks:{three:['three']},
      // EdgeOne serves .mjs assets as application/octet-stream. Module workers
      // require a JavaScript MIME type, so keep their URL imports but emit .js.
      assetFileNames:asset=>(asset.names||[asset.name]).some(name=>name?.endsWith('.mjs'))
        ?'assets/[name]-[hash].js':'assets/[name]-[hash][extname]'
    }}
  }
});
