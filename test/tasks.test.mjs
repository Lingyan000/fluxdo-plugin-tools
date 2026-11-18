import test from 'node:test';
import assert from 'node:assert/strict';
import {checkManifest} from '../packages/cli/dist/project.mjs';
import {readFileSync} from 'node:fs';
import {createPluginHarness} from '../packages/sdk/testing/index.mjs';
const base=JSON.parse(readFileSync(new URL('../examples/forum-activity/plugin.json',import.meta.url)));
test('任务权限和角标依赖匹配宿主清单',()=>{
  const manifest={...base,schema:12,requiredFeatures:[...base.requiredFeatures,'scheduledTasks','navigationBadge','localNotifications'],permissions:{...base.permissions,background:true,notifications:true},tasks:[{id:'refresh',title:'更新'}]};
  checkManifest(manifest);
  for(const bad of [{schema:11},{tasks:[]},{tasks:[...manifest.tasks,...manifest.tasks]},{requiredFeatures:base.requiredFeatures},{pages:[{id:'feed',title:'动态',widget:'Activity'}]}]) assert.throws(()=>checkManifest({...manifest,...bad}));
});
test('任务测试上下文可写入匹配的值，拒绝过期结果',async()=>{
  const host=createPluginHarness({script:`fluxdo.on('task.run',async ctx=>{const db=ctx.api.storage;await db.compareAndSet('n',null,{v:1});await db.compareAndSet('n',null,{v:2});});`});
  try {await host.dispatch('task.run',{id:'refresh'},{surface:'t1',kind:'task',params:{id:'refresh'}});assert.deepEqual(host.storage.n,{v:1});} finally {host.close();}
});
