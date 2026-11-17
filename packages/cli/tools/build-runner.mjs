import {build} from 'vite';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
await build({
  root, configFile:false, envDir:false, logLevel:'warn',
  define:{global:'globalThis'},
  build:{
    emptyOutDir:false, minify:true, target:'es2022',
    lib:{entry:fileURLToPath(new URL('../src/dev/runner.ts',import.meta.url)),name:'FluxdoDev',formats:['iife'],fileName:()=> 'dev/runner.js'},
    rolldownOptions:{platform:'neutral',resolve:{mainFields:['module','main']},output:{codeSplitting:false}},
  },
});

const {copyFile}=await import('node:fs/promises');
await copyFile(new URL('../../sdk/contract.json',import.meta.url),new URL('../dist/contract.json',import.meta.url));
await copyFile(new URL('../../sdk/schema/plugin.schema.json',import.meta.url),new URL('../dist/plugin.schema.json',import.meta.url));

await copyFile(new URL('../../sdk/schema/components.json',import.meta.url),new URL('../dist/components.json',import.meta.url));
