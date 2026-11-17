import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPlugin} from '../packages/create-fluxdo-plugin/dist/create.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
test('CLI 标准流提供版本握手、模块请求和断开释放',{timeout:15000},async t=>{
 const temp=await mkdtemp(join(tmpdir(),'fluxdo-stdio-'));
 const project=await createPlugin({directory:join(temp,'sample')});
 const child=spawn(process.execPath,[join(root,'packages/cli/dist/bin.mjs'),'dev',project,'--stdio'],{stdio:['pipe','pipe','pipe'],windowsHide:true});
 let stderr='';child.stderr.on('data',chunk=>stderr+=chunk);
 const exited=new Promise(resolve=>child.once('exit',resolve));
 const messages=[],waiting=[];
 createInterface({input:child.stdout}).on('line',line=>{const packet=JSON.parse(line);messages.push(packet);for(const done of waiting.splice(0))done();});
 async function until(test){for(let attempt=0;attempt<100;attempt++){const result=messages.find(test);if(result)return result;await Promise.race([new Promise(resolve=>waiting.push(resolve)),new Promise(resolve=>setTimeout(resolve,50))]);}throw new Error(stderr||'开发协议响应超时');}
 t.after(async()=>{child.kill();await exited;await rm(temp,{recursive:true,force:true});});
 const hello=await until(p=>p.type==='fluxdo:ready');assert.equal(hello.protocolVersion,1);assert.equal(hello.entry,'/src/main.ts');
 child.stdin.write(JSON.stringify({type:'custom',event:'vite:invoke',data:{id:'send:1',name:'getBuiltins',data:[]}})+'\n');
 const reply=await until(p=>p.event==='vite:invoke');assert.deepEqual(reply.data.data.result,[]);
 child.stdin.end();assert.equal(await exited,0);
});
