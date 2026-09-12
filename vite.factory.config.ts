import {defineConfig} from 'vite';export default defineConfig({root:'factory',base:'/factory/',esbuild:{jsx:'automatic'},build:{outDir:'../dist/factory',emptyOutDir:false,target:'es2022'}});
