import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,readFile,writeFile,readdir,rm,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Script,createContext} from 'node:vm';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const npmCli=process.env.FLUXDO_NPM_CLI??[
 join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),
 resolve(dirname(process.execPath),'../lib/node_modules/npm/bin/npm-cli.js'),
].find(candidate=>existsSync(candidate));
assert.ok(npmCli,'未找到 npm CLI；可通过 FLUXDO_NPM_CLI 指定 npm-cli.js 路径');
function run(file,args,cwd){
 const result=spawnSync(process.execPath,[file,...args],{cwd,encoding:'utf8',windowsHide:true,timeout:120000});
 assert.equal(result.status,0,result.stdout+'\n'+result.stderr);return result.stdout;
}
test('实际 tgz 在仓库外安装后完成创建、检查、构建和打包',{timeout:180000},async t=>{
 run(join(root,'tools/pack-release.mjs'),[],root);
 const sums=(await readFile(join(root,'artifacts/SHA256SUMS.txt'),'utf8')).trim().split('\n');
 assert.equal(sums.length,3);
 for(const line of sums){
  const [hash,file]=line.split('  ');
  assert.match(hash,/^[a-f0-9]{64}$/);
  assert.equal(createHash('sha256').update(await readFile(join(root,'artifacts',file))).digest('hex'),hash);
 }
 const temp=await mkdtemp(join(tmpdir(),'fluxdo release 空间-'));
 t.after(()=>rm(temp,{recursive:true,force:true,maxRetries:6,retryDelay:250}));
 await writeFile(join(temp,'package.json'),'{"private":true}');
 run(npmCli,['install','--ignore-scripts','--no-audit','--no-fund',join(root,'artifacts/create-fluxdo-plugin-0.4.0.tgz')],temp);
 const createBin=join(temp,'node_modules/create-fluxdo-plugin/dist/bin.mjs');
 const target=join(temp,'my-plugin');
 run(createBin,[target,'--yes','--id','com.example.generated'],temp);
 const pkgPath=join(target,'package.json');const pkg=JSON.parse(await readFile(pkgPath,'utf8'));
 // 发行前验证同一批真实包，GitHub URL 在发布后的验证中使用。
 pkg.devDependencies['@fluxdo/plugin-cli']='file:'+join(root,'artifacts/fluxdo-plugin-cli-0.4.0.tgz').replaceAll('\\','/');
 pkg.devDependencies['@fluxdo/plugin-sdk']='file:'+join(root,'artifacts/fluxdo-plugin-sdk-0.4.0.tgz').replaceAll('\\','/');
 await writeFile(pkgPath,JSON.stringify(pkg,null,2));
 run(npmCli,['install','--ignore-scripts','--no-audit','--no-fund'],target);
 for(const command of ['check','build','pack:plugin','test'])run(npmCli,['run',command],target);
 run(join(target,'node_modules/@fluxdo/plugin-cli/dist/bin.mjs'),['market-entry','--repository','https://github.com/example/plugins','--tag','v1.0.0'],target);
 const market=JSON.parse(await readFile(join(target,'dist/market-entry.json'),'utf8'));assert.equal(market.id,'com.example.generated');assert.match(market.sha256,/^[a-f0-9]{64}$/);
 const bundleFile=(await readdir(join(target,'dist'))).find(v=>v.endsWith('.fluxplugin'));
 assert.ok(bundleFile);
 const bundle=JSON.parse(await readFile(join(target,'dist',bundleFile),'utf8'));
 assert.equal(bundle.manifest.id,'com.example.generated');
 await copyFile(join(target,'dist',bundleFile),join(root,'artifacts/verification.fluxplugin'));
 assert.deepEqual(Object.keys(bundle.files).sort(),[bundle.manifest.script,bundle.manifest.ui].sort());
 assert.ok(!bundle.files[bundle.manifest.script].includes('import.meta.hot'));
 const handlers=new Map(),writes=[];
 const context=createContext({fluxdo:{on:(event,handler)=>handlers.set(event,handler)}});
 new Script(bundle.files[bundle.manifest.script]).runInContext(context);
 const storage=new Map();
 const ctx={setData:(key,value)=>writes.push([key,value]),api:{
  storage:{get:async key=>storage.get(key),set:async(key,value)=>storage.set(key,value)},
  dialogs:{confirm:async()=>true},toast:async()=>{},
 }};
 await handlers.get('card.load')(ctx);await handlers.get('increment')(ctx);
 assert.deepEqual(writes,[['count',0],['count',1]]);
 const previous=await readFile(join(target,'dist',bundle.manifest.script),'utf8');
 await writeFile(join(target,'src/main.ts'),'const broken: number = "invalid";');
 const bad=spawnSync(process.execPath,[npmCli,'run','build'],{cwd:target,encoding:'utf8',windowsHide:true});
 assert.notEqual(bad.status,0);assert.equal(await readFile(join(target,'dist',bundle.manifest.script),'utf8'),previous);
 await writeFile(join(target,'src/main.ts'),"import 'node:fs';");
 const forbidden=spawnSync(process.execPath,[npmCli,'run','build'],{cwd:target,encoding:'utf8',windowsHide:true});
 assert.notEqual(forbidden.status,0);assert.equal(await readFile(join(target,'dist',bundle.manifest.script),'utf8'),previous);
});
