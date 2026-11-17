import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {WebSocket} from '../packages/cli/node_modules/ws/wrapper.mjs';
import {createDeviceServer} from '../packages/cli/dist/dev/session.mjs';

async function project(t){
  const root=await mkdtemp(join(tmpdir(),'fluxdo-device-'));
  const manifest={schema:10,apiVersion:2,id:'example.device',name:'Device',version:'1.0.0',author:'test',ui:'ui.rfwtxt',script:'main.js',card:{widget:'Card'},permissions:{network:[]}};
  await mkdir(join(root,'src'));
  await writeFile(join(root,'src/main.ts'),"fluxdo.on('card.load',ctx=>ctx.setData('hello',1));if(import.meta.hot)import.meta.hot.accept();");
  await writeFile(join(root,'ui.rfwtxt'),'import fluxdo; widget Card = Label(text: "first");');
  await writeFile(join(root,'plugin.json'),JSON.stringify(manifest));
  await writeFile(join(root,'package.json'),'{"type":"module"}');
  t.after(()=>rm(root,{recursive:true,force:true}));return {root,manifest};
}
function connect(server,token,origin){
  const url=new URL(server.url);
  const socket=new WebSocket(`ws://127.0.0.1:${server.port}/fluxdo`,{headers:{Authorization:'Bearer '+(token??url.searchParams.get('key')),...(origin?{Origin:origin}:{})}});
  const messages=[]; const waiters=[];
  socket.on('message',raw=>{const message=JSON.parse(raw);messages.push(message);for(const waiter of [...waiters])if(waiter.test(message)){waiters.splice(waiters.indexOf(waiter),1);clearTimeout(waiter.timer);waiter.resolve(message);}});
  return {socket,messages,wait(test){const found=messages.find(test);if(found)return Promise.resolve(found);return new Promise((resolve,reject)=>{const w={test,resolve,timer:setTimeout(()=>reject(new Error('packet timeout')),10000)};waiters.push(w);});}};
}
test('设备配对拒绝错误令牌和浏览器来源，重连替换旧连接，RFW 原子更新',async t=>{
  const {root,manifest}=await project(t);
  const logs=[];
  const server=await createDeviceServer({root,port:0,onLog:e=>logs.push(e)});
  t.after(()=>server.close());
  for(const [token,origin] of [['invalid',undefined],[undefined,'http://evil.example']]){
    const {socket}=connect(server,token,origin);
    const [error]=await once(socket,'error');assert.match(error.message,/401/);
  }
  const a=connect(server);const initial=await a.wait(m=>m.type==='project');
  assert.equal(initial.manifest.id,manifest.id);assert.equal(initial.protocolVersion,1);assert.match(initial.runner,/FluxdoDev/);
  const closed=once(a.socket,'close');const b=connect(server);await b.wait(m=>m.type==='project');
  assert.equal((await closed)[0],4001);
  await writeFile(join(root,'ui.rfwtxt'),'import fluxdo; widget Card = Label(text: "changed");');
  const update=await b.wait(m=>m.type==='ui');assert.equal(update.revision,2);assert.match(update.ui,/changed/);
  b.socket.send(JSON.stringify({type:'log',entry:{pluginId:manifest.id,message:'hello',runtimeId:'dev'}}));
  await new Promise(r=>setTimeout(r,50));assert.equal(logs.length,1);
  b.socket.send(JSON.stringify({type:'vite',payload:{type:'custom',event:'vite:invoke',data:{id:'send:1',name:'getBuiltins',data:[]}}}));
  assert.deepEqual((await b.wait(m=>m.type==='vite')).payload.data.data.result,[]);
  await writeFile(join(root,'plugin.json'),'{broken');
  await b.wait(m=>m.type==='diagnostic');
  b.socket.send(JSON.stringify({type:'sync'}));
  await new Promise(r=>setTimeout(r,50));assert.equal(b.messages.filter(m=>m.type==='project').at(-1).manifest.id,manifest.id);
  const invalid=once(b.socket,'close');
  b.socket.send(JSON.stringify({type:'log',entry:{pluginId:'another.plugin',message:'forbidden'}}));
  assert.equal((await invalid)[0],1008);assert.equal(logs.length,1);
});
