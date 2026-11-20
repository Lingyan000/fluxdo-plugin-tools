import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,readFile,writeFile,rm,access,mkdir,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPlugin} from '../packages/create-fluxdo-plugin/dist/create.mjs';
import {checkManifest,loadProject,resourcePath} from '../packages/cli/dist/project.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
test('脚手架生成独立项目，保留输入文本且拒绝覆盖',async t=>{
 const temp=await mkdtemp(join(tmpdir(),'fluxdo-scaffold-'));t.after(()=>rm(temp,{recursive:true,force:true}));
 const target=await createPlugin({directory:join(temp,'my-plugin'),id:'com.example.demo',name:'测试 "原生" 插件',author:'开发者'});
 const manifest=JSON.parse(await readFile(join(target,'plugin.json'),'utf8'));
 assert.equal(manifest.name,'测试 "原生" 插件');checkManifest(manifest);
 const pkg=JSON.parse(await readFile(join(target,'package.json'),'utf8'));
 assert.equal(pkg.name,'my-plugin');assert.ok(pkg.devDependencies['@fluxdo/plugin-sdk'].includes('/v0.7.0/'));
 assert.ok(!(await readFile(join(target,'tsconfig.json'),'utf8')).includes('../../../'));
 await access(join(target,'.gitignore'));
 await assert.rejects(()=>createPlugin({directory:target}),/已存在/);
 await assert.rejects(()=>createPlugin({directory:join(temp,'invalid'),template:'../basic'}),/未知模板/);
 await assert.rejects(()=>createPlugin({directory:join(temp,'bad'),id:'INVALID ID'}),/插件 ID/);
});
test('清单检查报告未知能力、重复页面和无权限回调',async()=>{
 const base=JSON.parse(await readFile(join(root,'packages/create-fluxdo-plugin/templates/basic/plugin.json'),'utf8'));
 assert.throws(()=>checkManifest({...base,requiredFeatures:['missingFeature']}),/清单无效/);
 assert.throws(()=>checkManifest({...base,version:'1.0.0-01'}),/SemVer/);
 assert.throws(()=>checkManifest({...base,pages:[{id:'page',widget:'Page',title:'a'},{id:'page',widget:'Page',title:'b'}]}),/重复/);
 assert.throws(()=>checkManifest({...base,permissions:{network:[],connect:['https://example.org/callback']}}),/网络权限/);
 for(const path of ['../x','/x','a/../../b','x%2fy','x\\y','https://a/b','a//b'])assert.throws(()=>resourcePath(path));
});
test('模板资源不接受指向项目之外的目录链接',async t=>{
 const temp=await mkdtemp(join(tmpdir(),'fluxdo-path-'));t.after(()=>rm(temp,{recursive:true,force:true}));
 const target=await createPlugin({directory:join(temp,'sample')});
 const outside=join(temp,'outside');await mkdir(outside);await writeFile(join(outside,'main.ts'),'');
 await symlink(outside,join(target,'linked'),process.platform==='win32'?'junction':'dir');
 await writeFile(join(target,'fluxdo.config.json'),'{"entry":"linked/main.ts"}');
 await assert.rejects(()=>loadProject(target),/目录之外/);
});

test('卡片默认页需要能力声明且只能引用普通页面',async()=>{
 const base=JSON.parse(await readFile(join(root,'packages/create-fluxdo-plugin/templates/basic/plugin.json'),'utf8'));
 const valid={...base,requiredFeatures:['cardNavigation'],card:{widget:'Card',page:'home'},pages:[{id:'home',widget:'Home',title:'首页'}]};
 checkManifest(valid);
 for(const change of [{requiredFeatures:[]},{card:{widget:'Card',page:'missing'}},{card:{widget:'Card',page:''}},{pages:[{id:'home',widget:'Home',presentation:'modal',title:'弹层'}]}])assert.throws(()=>checkManifest({...valid,...change}));
 checkManifest({...valid,card:{widget:'Card'},requiredFeatures:[]});
});
