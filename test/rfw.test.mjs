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

test('RFW 参数契约覆盖士多和动态订阅的实际界面',async()=>{
 const root=process.env.FLUXDO_APP;
 if(!root)return;
 const ui=await readFile(root+'/test/fixtures/metaverse/ld-store/ui.rfwtxt','utf8');
 assert.ok(validateUi(ui).length>0);
 const activity=JSON.parse(await readFile(root+'/test/fixtures/metaverse/activity-feed-1.3.1.fluxplugin','utf8'));
 assert.ok(validateUi(activity.files[activity.manifest.ui]).includes('Following'));
});

test('首发草稿包使用的组件与参数可由同版 SDK 校验',async t=>{
 const root=process.env.FLUXDO_APP;if(!root){t.skip('原生宿主联调提供草稿包');return;}
 for(const name of ['ld-store','activity-feed','quick-notes']){
  const bundle=JSON.parse(await readFile(root+'/test/fixtures/metaverse/release/'+name+'-1.0.0.fluxplugin','utf8'));
  assert.ok(validateUi(bundle.files[bundle.manifest.ui]).length>0);
 }
});

test('旧发行包建立的订阅、未读和缓存可由新发行包直接使用', async t => {
  const app = process.env.FLUXDO_APP;
  if (!app) { t.skip('原生宿主联调提供发行包'); return; }
  const surface = {surface: 'feed', kind: 'page', page: 'feed', params: {}};
  let day = 1, allowed = true, reads = 0;
  const mocks = {
    'host.environment': () => ({locale: 'zh', platform: 'test'}),
    'permissions.status': () => ({forumProfiles: true, forumActivity: allowed}),
    'tasks.list': () => [], 'notifications.isAllowed': () => false, 'navigation.setBadge': () => null,
    'forum.read': ({resource, username}) => {
      reads++;
      if (resource === 'user') return {id: 1, username};
      const items = resource === 'actions' ? Array.from({length: day}, (_, index) => ({
        id: 'action-' + index, action: 'topics', topicId: 1, createdAt: '2026-10-0' + (1 + index) + 'T12:00:00Z',
        title: '测试话题', excerpt: '这是一段摘要',
      })) : [];
      return {items};
    },
  };
  async function start(version, initialStorage) {
    const bundle = JSON.parse(await readFile(app + '/test/fixtures/metaverse/activity-feed-' + version + '.fluxplugin','utf8'));
    const host = createPluginHarness({script: bundle.files[bundle.manifest.script], mocks, initialStorage});
    t.after(() => host.close());
    return host;
  }
  const old = await start('1.0.0');
  await old.dispatch('add', {value: 'mori'}, surface);
  day = 2;
  await old.dispatch('task.run', {id: 'refresh'}, {surface:'task', kind:'task', params:{}});
  await old.dispatch('page.resume', {}, surface);
  assert.equal(old.data.feed.title, '1 位订阅 · 1 条未读');
  allowed = false;
  const next = await start('1.3.0', old.storage);
  const before = reads;
  await next.dispatch('page.open', {}, surface);
  assert.equal(reads, before);
  assert.equal(next.data.feed.needsActivity, true);
  assert.equal(next.data.feed.title, old.data.feed.title);
  assert.equal(next.data.feed.items[0].name, 'mori');
  await next.dispatch('unread', {}, surface);
  assert.equal(next.data.feed.items.length, 1);
  allowed = true;
  await next.dispatch('refresh', {}, surface);
  assert.equal(next.data.feed.items[0].summary, '这是一段摘要');
  assert.equal(next.data.feed.title, old.data.feed.title);
});

 test('展示组件参数和固定工具区可静态校验',()=>{
 assert.ok(validateUi('import fluxdo; widget Card = Statistics(items:[{value:"2",label:"订阅"}]); widget Home = PageLayout(toolbar:SearchInput(),children:[Amount(value:"12.00",unit:"LDC"),QuantityInput(min:1,max:3,value:2),Markdown(text:"**正文**"),Image(url:"https://example.org/a.png",preview:true),CopyButton(text:"内容")]);').includes('Home'));
 assert.throws(()=>validateUi('import fluxdo; widget Card = Statistics(unknown:true);'),/不支持参数/);
 });

test('参数类型及嵌套表单错误在构建前定位，动态数据保持支持',()=>{
 assert.throws(()=>validateUi('import fluxdo; widget Card = Button(loading:"yes");'),/Button.loading 应为 boolean/);
 assert.throws(()=>validateUi('import fluxdo; widget Card = FormPage(fields:[{name:"a",required:"yes",maxLength:"10"}]);'),/fields\[0\].required/);
 assert.throws(()=>validateUi('import fluxdo; widget Card = FormPage(fields:[{name:"a",options:[{value:false}]}]);'),/options\[0\].value/);
 assert.deepEqual(validateUi('import fluxdo; widget Card = Label(text:["数量",data.count]);'),['Card']);
 assert.deepEqual(validateUi('import fluxdo; widget Card = Button(loading:data.busy);'),['Card']);
});
