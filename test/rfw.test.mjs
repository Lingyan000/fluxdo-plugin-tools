import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateUi} from '../packages/cli/dist/project.mjs';
import {createPluginHarness} from '../packages/sdk/testing/index.mjs';
test('官方 RFW 解析器校验语法、组件和参数，支持自定义组件',()=>{
 assert.deepEqual(validateUi('import fluxdo; widget Card = Column(children:[Label(text:"hello")]);'),['Card']);
 assert.throws(()=>validateUi('import fluxdo; widget Card = Label(text:"a", text:"b");'));
 assert.throws(()=>validateUi('import fluxdo; widget Card = Label(typo:"x");'),/不支持参数 typo/);
 assert.throws(()=>validateUi('import fluxdo; widget Card = Unknown();'),/未知组件/);
 assert.throws(()=>validateUi('import fluxdo; widget Card = Label(text:"broken);'));
 assert.deepEqual(validateUi('import fluxdo; widget Tile = Label(text:args.title); widget Card = Tile(title:"x");'),['Tile','Card']);
});
test('模拟宿主只使用显式 API 替身，取消不会执行后续网络副作用',async t=>{
 let approved=false;
 const host=createPluginHarness({script:`fluxdo.on('submit',async ctx=>{if(!await ctx.api.dialogs.confirm({title:'Confirm'}))return;const response=await ctx.api.fetch('https://example.test/order',{method:'POST',body:{count:1}});ctx.setData('result',response.json());});`,mocks:{
 'dialogs.confirm':()=>approved,'fetch':()=>({status:200,headers:{},body:'{"id":123}'}),
 }});t.after(()=>host.close());
 await host.dispatch('submit');assert.equal(host.calls.filter(c=>c.m==='fetch').length,0);
 approved=true;await host.dispatch('submit');assert.equal(host.data.s1.result.id,123);
});

test('RFW 参数契约覆盖士多插件实际界面',async()=>{
 const root=process.env.FLUXDO_APP;
 if(!root)return;
 const ui=await readFile(root+'/test/fixtures/metaverse/ld-store/ui.rfwtxt','utf8');
 assert.ok(validateUi(ui).length>0);
});
