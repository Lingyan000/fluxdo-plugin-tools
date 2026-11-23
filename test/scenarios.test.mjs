import test from 'node:test';import assert from 'node:assert/strict';
import {createPluginHarness,createScenario} from '../packages/sdk/testing/index.mjs';
test('权限撤销、离线、账号失效和恢复响应可复现',async()=>{
 const scenario=createScenario({permissions:{forumActivity:true,identity:true}}),h=createPluginHarness({script:'fluxdo.on("read",async ctx=>ctx.setData("items",await ctx.api.forum.read({resource:"actions",username:"demo"})));',mocks:scenario.mocks});
 try{scenario.respond({items:[1]});await h.dispatch('read');assert.deepEqual(h.data.s1.items,{items:[1]});
 scenario.grant('forumActivity',false);await h.dispatch('read');assert.match(h.logs.at(-1).message,/permission_denied/);
 scenario.grant('forumActivity');scenario.offline(true);await h.dispatch('read');assert.match(h.logs.at(-1).message,/network_unavailable/);
 scenario.offline(false);scenario.account(null);await h.dispatch('read');assert.match(h.logs.at(-1).message,/forum_auth_required/);
 }finally{h.close();}
});
test('虚拟时间验证重试，不等待真实定时器',async()=>{const h=createPluginHarness({virtualTimers:true,script:'fluxdo.on("start",ctx=>setTimeout(()=>ctx.setData("done",true),1000));'});try{await h.dispatch('start');await h.advance(999);assert.equal(h.data.s1,undefined);await h.advance(1);assert.equal(h.data.s1.done,true);}finally{h.close();}});
test('数据迁移可以直接对旧存储快照回归',async()=>{const h=createPluginHarness({initialStorage:{old:[1,2]},script:'fluxdo.on("storage.migrate",async(ctx,args)=>ctx.api.storage.setMany({items:await ctx.api.storage.get("old"),old:null,version:args.toVersion}));'});try{await h.dispatch('storage.migrate',{fromVersion:1,toVersion:2});assert.deepEqual(h.storage,{items:[1,2],version:2});assert.equal(h.logs.length,0);}finally{h.close();}});

test('通知系统许可与插件授权分开模拟',()=>{const s=createScenario({permissions:{notifications:true}});s.notificationSystem('denied');assert.equal(s.mocks['notifications.requestPermission'](),false);assert.deepEqual(s.mocks['notifications.status'](),{authorized:true,system:'denied',canOpenSettings:true});assert.throws(()=>s.mocks['notifications.show'](),/notification_system_denied/);s.notificationSystem('allowed');assert.equal(s.mocks['notifications.show'](),true);s.grant('notifications',false);assert.equal(s.mocks['notifications.status']().authorized,false);});
