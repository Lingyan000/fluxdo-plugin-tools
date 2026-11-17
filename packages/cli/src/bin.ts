#!/usr/bin/env node
import {parseArgs} from 'node:util';
import {readFile} from 'node:fs/promises';
import {satisfies} from 'semver';
import {createInterface} from 'node:readline';
import {resolve, relative} from 'node:path';
import {createPluginDevServer} from './dev/server.js';
import {loadProject,typecheck,buildProject,packProject} from './project.js';

const metadata=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const help=`FluxDO 插件工具
  fluxdo check [目录]         检查类型、清单及界面引用
  fluxdo build [目录]         构建宿主可加载的独立脚本
  fluxdo pack [目录]          重新构建并生成 .fluxplugin 与摘要
  fluxdo doctor              检查 Node 工具链
  fluxdo dev [目录] --stdio   通过标准输入输出提供开发模块协议

完整 RFW 语法由应用校验。dev --stdio 供宿主/测试适配器连接，当前应用尚无手机配对入口。`;
try{
  const {values,positionals}=parseArgs({allowPositionals:true,options:{help:{type:'boolean',short:'h'},version:{type:'boolean',short:'v'},stdio:{type:'boolean'}}});
  if(values.version)console.log(metadata.version);
  else if(values.help||!positionals.length)console.log(help);
  else {
    const [command,dir='.']=positionals;
    const root=resolve(dir);
    switch(command){
      case 'doctor':
        if(!satisfies(process.versions.node,metadata.engines.node))throw new Error('需要 Node 24.11 或以上版本');
        console.log(`Node ${process.version}；Vite 模块服务可用；SDK API 2 / schema 10`);break;
      case 'check':await typecheck(await loadProject(root));console.log('类型、清单和界面引用检查通过');break;
      case 'build':await buildProject(root);console.log('已构建 '+resolve(root,'dist'));break;
      case 'pack':console.log(JSON.stringify(await packProject(root),null,2));break;
      case 'dev':{
        if(!values.stdio)throw new Error('目前支持 fluxdo dev --stdio，手机配对入口尚未接入');
        const project=await loadProject(root);
        const send=(payload:unknown)=>process.stdout.write(JSON.stringify(payload)+'\n');
        const server=await createPluginDevServer({root:project.root,onError:error=>process.stderr.write(String(error)+'\n')});
        const connection=server.connect(send);
        send({type:'fluxdo:ready',protocolVersion:1,entry:'/'+relative(project.root,project.entry).replaceAll('\\','/'),pluginId:project.manifest.id});
        const input=createInterface({input:process.stdin,crlfDelay:Infinity});
        const close=async()=>{connection.close();input.close();await server.close();};
        process.once('SIGINT',()=>{void close();});process.once('SIGTERM',()=>{void close();});
        try{for await(const line of input){if(Buffer.byteLength(line)>1024*1024)throw new Error('开发消息过大');connection.receive(JSON.parse(line));}}
        finally{await close();}
        break;
      }
      default:throw new Error('未知命令：'+command+'\n'+help);
    }
  }
}catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}
