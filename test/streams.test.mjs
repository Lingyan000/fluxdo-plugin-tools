import test from 'node:test';
import assert from 'node:assert/strict';
import {createPluginHarness} from '../packages/sdk/testing/index.mjs';

test('事件流 API 与界面上下文绑定，模拟帧和状态可驱动插件',async t=>{
 const host=createPluginHarness({script:`
 fluxdo.on('page.open',async ctx=>ctx.api.streams.open({id:'updates',url:'https://service.example/events',credential:'account'}));
 fluxdo.on('stream.event',(ctx,frame)=>ctx.setData('unread',JSON.parse(frame.data).unread));
 fluxdo.on('stream.state',(ctx,state)=>ctx.setData('state',state.state));
 fluxdo.on('stop',ctx=>ctx.api.streams.close('updates'));
 `,mocks:{'streams.open':p=>p.id,'streams.close':()=>null}});
 t.after(()=>host.close());
 const surface={surface:'inbox',kind:'page',page:'inbox',params:{}};
 await host.dispatch('page.open',{},surface);
 assert.equal(host.calls[0].s,'inbox');assert.equal(host.calls[0].p.credential,'account');
 await host.dispatch('stream.state',{id:'updates',state:'open'},surface);
 await host.dispatch('stream.event',{id:'updates',event:'summary.updated',data:'{"unread":3}',lastEventId:'5'},surface);
 assert.equal(host.data.inbox.unread,3);assert.equal(host.data.inbox.state,'open');
 await host.dispatch('stop',{},surface);assert.equal(host.calls.at(-1).m,'streams.close');
});

test('TypeScript 按事件名称推导帧与连接状态类型',async()=>{
 const {mkdtemp,writeFile,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');
 const {join,resolve}=await import('node:path');
 const {fileURLToPath}=await import('node:url');
 const {spawnSync}=await import('node:child_process');
 const root=fileURLToPath(new URL('../',import.meta.url));
 const dir=await mkdtemp(join(tmpdir(),'fluxdo-stream-types-'));
 try {
  const file=join(dir,'stream.ts');
  await writeFile(file,`fluxdo.on('stream.event',(ctx,frame)=>{const id:string=frame.lastEventId;ctx.setData('value',JSON.parse(frame.data));});
  fluxdo.on('stream.state',(ctx,state)=>{const status:number|undefined=state.status;ctx.setData('state',state.state);});
  fluxdo.on('storage.partition',async(ctx,args)=>{const id:number=args.accountId;return {legacy:args.legacy,account:args.account};});
  // @ts-expect-error 迁移处理器必须返回两份数据。
  fluxdo.on('storage.partition',async()=>{});`);
  const result=spawnSync(process.execPath,[resolve(root,'node_modules/typescript/bin/tsc'),'--noEmit','--skipLibCheck','--target','es2022','--types',resolve(root,'packages/sdk/types/global.d.ts'),file],{encoding:'utf8',windowsHide:true});
  assert.equal(result.status,0,result.stdout+result.stderr);
 }finally{await rm(dir,{recursive:true,force:true});}
});
