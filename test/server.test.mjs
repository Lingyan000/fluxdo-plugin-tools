import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPluginDevServer} from '../packages/cli/dist/dev/server.mjs';

const request=name=>({type:'custom',event:'vite:invoke',data:{id:'send:same-id',name,data:[]}});

test('模块调用只回复原连接，关闭后不接受新消息', async t=>{
  const root=await mkdtemp(join(tmpdir(),'fluxdo-devtools-test-'));
  const server=await createPluginDevServer({root});
  t.after(async()=>{await server.close();await rm(root,{recursive:true,force:true});});
  const first=[],second=[];
  let received;
  const reply=new Promise(resolve=>received=resolve);
  const a=server.connect(payload=>{first.push(payload);received();});
  const b=server.connect(payload=>second.push(payload));
  a.receive(request('getBuiltins'));
  await reply;
  assert.equal(first.length,1);assert.equal(second.length,0);
  assert.equal(first[0].data.id,'response:same-id');
  assert.deepEqual(first[0].data.data.result,[]);
  assert.throws(()=>b.receive(request('constructor')),/模块请求格式无效/);
  assert.throws(()=>b.receive({type:'custom',event:'vite:invoke',data:{name:'fetchModule'}}),/模块请求格式无效/);
  assert.throws(()=>b.receive(null),/开发消息格式无效/);
  a.close();assert.throws(()=>a.receive(request('getBuiltins')),/开发连接已关闭/);
  await server.close();
  assert.throws(()=>b.receive(request('getBuiltins')),/开发连接已关闭/);
  assert.throws(()=>server.connect(()=>{}),/开发模块服务已关闭/);
});
