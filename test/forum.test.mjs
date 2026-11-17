import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {checkManifest,loadProject,typecheck,validateUi} from '../packages/cli/dist/project.mjs';
import {createPluginHarness} from '../packages/sdk/testing/index.mjs';

test('论坛导航声明使用新 schema，旧版和弹层贡献被拒绝',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../examples/forum-activity/plugin.json',import.meta.url),'utf8'));
 checkManifest(manifest);
 assert.throws(()=>checkManifest({...manifest,requiredFeatures:[]}),/forumRead|navigationEntries/);
 assert.throws(()=>checkManifest({...manifest,schema:10}),/schema 11/);
 assert.throws(()=>checkManifest({...manifest,pages:[{...manifest.pages[0],presentation:'modal'}]}),/普通页面/);
 assert.throws(()=>checkManifest({...manifest,permissions:{...manifest.permissions,forum:['admin']}}),/清单无效/);
 const project=await loadProject(new URL('../examples/forum-activity',import.meta.url).pathname.replace(/^\/([A-Z]:)/i,'$1'));
 await typecheck(project);validateUi(project.ui);
});
test('论坛 API 通过当前界面调用，只有用户事件触发原生导航',async t=>{
 const host=createPluginHarness({script:`fluxdo.on('page.open',async ctx=>{const result=await ctx.api.forum.read({resource:'actions',username:'demo'});ctx.setData('items',result.items);});fluxdo.on('open',async ctx=>{await ctx.api.forum.open({type:'topic',topicId:42});});`,mocks:{
  'forum.read':()=>({items:[{topicId:42}],nextOffset:null}),'forum.open':()=>null,
 }});t.after(()=>host.close());
 await host.dispatch('page.open',{}, {surface:'activity',kind:'page',page:'activity',params:{}});
 assert.equal(host.calls.length,1);assert.equal(host.calls[0].s,'activity');
 assert.equal(host.data.activity.items[0].topicId,42);
 await host.dispatch('open',{}, {surface:'activity',kind:'page',page:'activity',params:{}});
 assert.equal(host.calls.at(-1).m,'forum.open');
});
