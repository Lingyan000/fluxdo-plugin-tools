import {defineConfig} from 'tsdown';
export default defineConfig({entry:['src/bin.ts','src/create.ts'],format:'esm',platform:'node',target:'node24',dts:true,clean:true,fixedExtension:true,unbundle:true});
