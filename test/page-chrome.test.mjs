import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {checkManifest,loadProject,validateUi} from '../packages/cli/dist/project.mjs';

test('标题栏组件声明能力，并在加载项目时核对引用',async t=>{
 const manifest=JSON.parse(await readFile(new URL('../examples/forum-activity/plugin.json',import.meta.url),'utf8'));
 manifest.requiredFeatures.push('pageChrome');
 manifest.pages[0].appBar={title:'PageTitle',actions:'PageActions'};
 checkManifest(manifest);
 assert.throws(()=>checkManifest({...manifest,requiredFeatures:manifest.requiredFeatures.filter(v=>v!=='pageChrome')}),/pageChrome/);
 for(const value of [{},{leading:'Back'},{actions:42}]){
   assert.throws(()=>checkManifest({...manifest,pages:[{...manifest.pages[0],appBar:value}]}),/清单无效/);
 }
 const root=await mkdtemp(join(tmpdir(),'fluxdo-chrome-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await writeFile(join(root,'plugin.json'),JSON.stringify(manifest));
 await writeFile(join(root,'fluxdo.config.json'),JSON.stringify({entry:'main.ts'}));
 await writeFile(join(root,'main.ts'),'');
 const ui='import fluxdo;\n'+[manifest.card?.widget,...manifest.pages.map(p=>p.widget)].filter(Boolean).map(w=>'widget '+w+' = SizedBoxShrink();').join('\n');
 await writeFile(join(root,manifest.ui),ui);
 await assert.rejects(loadProject(root),/界面缺少组件/);
 await writeFile(join(root,manifest.ui),ui+'\nwidget PageTitle = Label(text:"标题");\nwidget PageActions = IconButton(icon:"favorite",loading:false,selected:true,enabled:true);');
 await loadProject(root);
 validateUi('import fluxdo; widget Test = Column(children:[Statistics(loading:true),Button(label:"确认",fullWidth:true)]);');
});
