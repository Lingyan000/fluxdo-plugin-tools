#!/usr/bin/env node
import {parseArgs} from 'node:util';
import {readFile} from 'node:fs/promises';
import {intro,outro,text,select,isCancel,cancel} from '@clack/prompts';
import {createPlugin,templateNames} from './create.js';
try{
 const {values,positionals}=parseArgs({allowPositionals:true,options:{id:{type:'string'},name:{type:'string'},author:{type:'string'},template:{type:'string'},distribution:{type:'string'},yes:{type:'boolean',short:'y'},help:{type:'boolean',short:'h'},version:{type:'boolean',short:'v'}}});
 if(values.help){console.log('create-fluxdo-plugin <目录> [--id com.example.demo] [--name 名称] [--author 作者] [--template basic] [--distribution github|npm] [--yes]');}
 else if(values.version){console.log(JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version);}
 else{
  let directory=positionals[0],template=values.template;
  if(!values.yes&&process.stdin.isTTY){
   intro('创建 FluxDO 原生插件');
   if(!directory){const answer=await text({message:'项目目录',placeholder:'my-plugin',defaultValue:'my-plugin'});if(isCancel(answer)){cancel('已取消');process.exit(0);}directory=answer;}
   if(!template){const answer=await select({message:'选择模板',options:(await templateNames()).map(value=>({value,label:value==='basic'?'原生计数卡片':value}))});if(isCancel(answer)){cancel('已取消');process.exit(0);}template=answer;}
  }
  if(!directory)throw new Error('请提供项目目录，例如 create-fluxdo-plugin my-plugin --yes');
  if(values.distribution&&!['github','npm'].includes(values.distribution))throw new Error('分发方式须为 github 或 npm');
  const path=await createPlugin({directory,template,distribution:values.distribution as 'github'|'npm'|undefined,id:values.id,name:values.name,author:values.author});
  const message=`已创建 ${path}\n进入目录后运行：\n  pnpm install\n  pnpm check\n  pnpm build\n  pnpm pack:plugin`;
  if(process.stdout.isTTY&&!values.yes)outro(message);else console.log(message);
 }
}catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}
