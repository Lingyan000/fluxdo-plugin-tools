#!/usr/bin/env node
import {toString as renderQr} from 'qrcode';
import {inspectDevice} from './diagnostics.js';
import {localizeProject} from '../localization/compiler.mjs';
import {parseArgs} from 'node:util';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {satisfies} from 'semver';
import {createInterface} from 'node:readline';
import {resolve, relative} from 'node:path';
import {createPluginDevServer} from './dev/server.js';
import {createDeviceServer} from './dev/session.js';
import {loadProject,typecheck,buildProject,packProject,createMarketEntry} from './project.js';

const metadata=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const contract=JSON.parse(await readFile(new URL('./contract.json',import.meta.url),'utf8'));
const help=`FluxDO 插件工具
  fluxdo localize [目录]      编译本地化脚本、界面和清单
  fluxdo check [目录]         检查类型、清单及界面引用
  fluxdo build [目录]         构建宿主可加载的独立脚本
  fluxdo pack [目录]          重新构建并生成 .fluxplugin 与摘要
  fluxdo test [目录]          构建并运行插件模拟宿主测试
  fluxdo market-entry [目录] --repository URL --tag TAG
                             构建并生成 GitHub 市场条目草稿
  --key 文件 --previous-key 文件  为包签名，第二项仅在轮换密钥时提供
  --channel stable|preview       市场发布渠道
  fluxdo doctor [目录] --pair 地址  检查工具链、项目与已连接宿主
  fluxdo dev [目录]           连接 App 原生预览（默认端口 5174）
  fluxdo dev [目录] --lan 本机IP  加密无线配对（Android / iOS / 桌面）
  fluxdo dev [目录] --stdio   通过标准输入输出提供开发模块协议

在 App 开发中心打开「连接开发工具」并粘贴配对地址。Android 先运行 adb reverse tcp:5174 tcp:5174。`;
try{
  const {values,positionals}=parseArgs({allowPositionals:true,options:{help:{type:'boolean',short:'h'},version:{type:'boolean',short:'v'},stdio:{type:'boolean'},lan:{type:'string'},port:{type:'string'},repository:{type:'string'},tag:{type:'string'},key:{type:'string'},'previous-key':{type:'string'},channel:{type:'string'},pair:{type:'string'},check:{type:'boolean'}}});
  if(values.version)console.log(metadata.version);
  else if(values.help||!positionals.length)console.log(help);
  else {
    const [command,dir='.']=positionals;
    const root=resolve(dir);
    const signing={key:values.key,previousKey:values['previous-key']};
    if(values.channel&&!['stable','preview'].includes(values.channel))throw new Error('渠道须为 stable 或 preview');
    switch(command){
      case 'localize':console.log(await localizeProject(root,{check:values.check}));break;
      case 'doctor':
        if(!satisfies(process.versions.node,metadata.engines.node))throw new Error('需要 Node 24.11 或以上版本');
        console.log(`Node ${process.version}；SDK API ${contract.apiVersion} / schema ${contract.manifestSchemas.join(', ')}`);
        if(positionals[1]){await typecheck(await loadProject(root));console.log('项目类型、清单与组件检查通过');}
        if(values.pair)console.log(JSON.stringify(await inspectDevice(values.pair),null,2));break;
      case 'check':await typecheck(await loadProject(root));console.log('类型、清单和界面引用检查通过');break;
      case 'build':await buildProject(root);console.log('已构建 '+resolve(root,'dist'));break;
      case 'pack':console.log(JSON.stringify(await packProject(root,signing),null,2));break;
      case 'market-entry':
        if(!values.repository||!values.tag)throw new Error('需要 --repository 与 --tag');
        console.log(await createMarketEntry(root,values.repository,values.tag,{...signing,channel:values.channel}));break;
      case 'test':{
        await buildProject(root);
        await new Promise<void>((done,reject)=>{
          const child=spawn(process.execPath,['--test','test/*.test.mjs'],{cwd:root,stdio:'inherit',windowsHide:true});
          child.on('error',reject);child.on('exit',code=>code===0?done():reject(new Error('插件测试失败')));
        });break;
      }
      case 'dev':{
        if(!values.stdio){
          const port=values.port===undefined?5174:Number(values.port);
          if(!Number.isInteger(port)||port<0||port>65535)throw new Error('端口无效');
          const server=await createDeviceServer({root,port,lanHost:values.lan,
            onStatus:message=>console.error(message),
            onLog:entry=>console.log(JSON.stringify(entry)),
          });
          console.error('在 App 开发中心扫码或粘贴配对地址：\n'+server.url);
          if(values.lan)process.stderr.write(await renderQr(server.url,{type:'terminal',small:true,errorCorrectionLevel:'M'}));
          if(!values.lan)console.error(`Android USB 转发：adb reverse tcp:${server.port} tcp:${server.port}`);
          await new Promise<void>(done=>{
            const close=()=>{void server.close().then(done);};
            process.once('SIGINT',close);process.once('SIGTERM',close);
          });
          break;
        }
        if(values.lan)throw new Error('--lan 不能与 --stdio 同时使用');
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
