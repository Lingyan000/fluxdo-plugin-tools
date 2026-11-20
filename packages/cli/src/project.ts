import {readFile, writeFile, mkdir, realpath, rename, rm} from 'node:fs/promises';
import {resolve, relative, isAbsolute, dirname, sep} from 'node:path';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import {Script} from 'node:vm';
import {build as viteBuild} from 'vite';
import {Ajv} from 'ajv';
import {valid as validVersion, prerelease} from 'semver';
import {signBundle,type SigningOptions} from './signing.js';
import {neutralImports} from './dev/server.js';

const require=createRequire(import.meta.url);
require('../vendor/rfw-validator.cjs');
const components=JSON.parse(await readFile(new URL('./components.json',import.meta.url),'utf8'));
export function validateUi(source:string):string[] {
  const result=JSON.parse((globalThis as any).fluxdoValidateRfw(source.replaceAll('\r\n','\n'),JSON.stringify(components)));
  if(result.diagnostics.length)fail(result.diagnostics.join('\n'));
  return result.widgets;
}
const contract=JSON.parse(await readFile(new URL('./contract.json',import.meta.url),'utf8'));
const schema=JSON.parse(await readFile(new URL('./plugin.schema.json',import.meta.url),'utf8'));
const validate=new Ajv({allErrors:true,strict:false}).compile(schema);
export interface Manifest {
  schema:number;apiVersion:number;id:string;name:string;version:string;author:string;
  ui:string;script:string;requiredFeatures?:string[];tasks?:{id:string;title:string}[];dataVersion?:number;preferences?:{key:string;type:string;default?:unknown;options?:Record<string,string>}[];
  permissions:{network:string[];background?:boolean;notifications?:boolean;forum?:('profiles'|'activity'|'following')[];connect?:string[];credentials?:Record<string,{requests:{origin:string}[]}>};
  card?:{widget:string;page?:string};pages?:{id:string;widget:string;appBar?:{title?:string;actions?:string};presentation?:string;navigation?:{label:string;icon?:string}}[];links?:{page:string}[];
}
export interface Project { root:string;manifest:Manifest;entry:string;ui:string }
function fail(message:string):never {throw new Error(message);}
export function resourcePath(path:string):string {
  if(typeof path!=='string'||!path||isAbsolute(path)||/[:?#%]/.test(path)||path.includes(String.fromCharCode(92))||path.split('/').some(s=>!s||s==='.'||s==='..'))fail('资源须为项目内的相对路径');
  return path;
}
export async function projectFile(root:string,path:string):Promise<string>{
  resourcePath(path);
  const target=await realpath(resolve(root,path));
  const rel=relative(root,target);
  if(!rel||rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel))fail('资源位于项目目录之外');
  return target;
}
export function checkManifest(raw:unknown):asserts raw is Manifest {
  if(!validate(raw))fail('插件清单无效：'+validate.errors?.map(e=>`${e.instancePath||'/'} ${e.message}`).join('；'));
  const m=raw as Manifest;
  if(!validVersion(m.version))fail('插件版本须符合 SemVer');
  if(Buffer.byteLength(JSON.stringify(m))>contract.limits.manifestBytes)fail('插件清单过大');
  resourcePath(m.ui);resourcePath(m.script);
  if(m.ui===m.script)fail('界面与脚本须使用不同文件');
  if(m.ui==='plugin.json'||m.script==='plugin.json')fail('资源文件不能覆盖清单');
  if(m.dataVersion!==undefined&&!m.requiredFeatures?.includes('dataMigrations'))fail('数据版本须声明 dataMigrations');
  if(m.preferences!==undefined&&!m.requiredFeatures?.includes('pluginPreferences'))fail('偏好设置须声明 pluginPreferences');
  if(m.preferences&&new Set(m.preferences.map(p=>p.key)).size!==m.preferences.length)fail('偏好设置键重复');
  for(const field of m.preferences??[]){
    if(field.type==='toggle'&&field.default!==undefined&&typeof field.default!=='boolean')fail('开关偏好默认值须为布尔值');
    if(field.type==='text'&&field.default!==undefined&&(typeof field.default!=='string'||field.default.length>512))fail('文本偏好默认值无效');
    if(field.type==='choice'&&(!(typeof field.default==='string')||!(field.default in (field.options??{}))))fail('选择偏好需要有效默认值');}
  if(m.permissions.forum && m.schema<11)fail('论坛读取权限需要 schema 11');
  if(m.permissions.forum?.length&&!m.requiredFeatures?.includes('forumRead'))fail('论坛读取须声明 forumRead');
  if(m.pages?.some(p=>p.navigation)&&!m.requiredFeatures?.includes('navigationEntries'))fail('导航入口须声明 navigationEntries');
  if((m.tasks || 'background' in m.permissions || 'notifications' in m.permissions || m.requiredFeatures?.includes('navigationBadge')) && m.schema<12)fail('任务、通知和角标需要 schema 12');
  if(m.permissions.background&&!m.tasks?.length)fail('后台权限需要至少一个任务');
  if(m.tasks?.length&&!m.requiredFeatures?.includes('scheduledTasks'))fail('任务须声明 scheduledTasks');
  if(m.permissions.notifications&&!m.requiredFeatures?.includes('localNotifications'))fail('通知须声明 localNotifications');
  if(m.requiredFeatures?.includes('navigationBadge')&&!m.pages?.some(p=>p.navigation))fail('角标需要导航页面');
  if(m.tasks?.some(t=>!t.title.trim())||new Set(m.tasks?.map(t=>t.id)).size!==(m.tasks?.length??0))fail('任务标题为空或 ID 重复');
  const ids=new Set<string>();
  for(const page of m.pages??[]){if(ids.has(page.id))fail('页面 ID 重复');ids.add(page.id);if(page.navigation&&(m.schema<11||page.presentation==='modal'))fail('导航入口需要 schema 11 的普通页面');}
  if(m.pages?.some(p=>p.appBar)&&!m.requiredFeatures?.includes('pageChrome'))fail('标题栏插槽须声明 pageChrome');
  if(m.card?.page && (!m.requiredFeatures?.includes('cardNavigation') || !m.pages?.some(p=>p.id===m.card!.page && p.presentation!=='modal')))fail('卡片入口需要 cardNavigation 并引用普通页面');
  for(const link of m.links??[])if(!ids.has(link.page))fail('链接指向未声明的页面');
  const endpoints=[...(m.permissions.connect??[]),...Object.values(m.permissions.credentials??{}).flatMap(v=>v.requests.map(r=>r.origin))];
  for(const endpoint of endpoints){
    const u=new URL(endpoint);
    if(u.protocol!=='https:'||u.port||u.username||u.password||u.search||u.hash)fail('能力地址须为不含凭证、查询参数的 HTTPS 地址');
    if(!m.permissions.network.some(h=>h===u.hostname||(h.startsWith('*.')&&u.hostname.endsWith(h.slice(1)))))fail('能力地址未声明网络权限');
  }
}
export async function loadProject(directory:string):Promise<Project>{
  const root=await realpath(resolve(directory));
  const raw=JSON.parse(await readFile(await projectFile(root,'plugin.json'),'utf8'));
  checkManifest(raw);
  let config:{entry?:string}={};
  try{config=JSON.parse(await readFile(await projectFile(root,'fluxdo.config.json'),'utf8'));}
  catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  const entry=await projectFile(root,config.entry??'src/main.ts');
  const ui=await readFile(await projectFile(root,raw.ui),'utf8');
  if(Buffer.byteLength(ui)>contract.limits.uiBytes)fail('界面文件过大');
  const checked = validateUi(ui);
  const widgets = new Set(checked);
  for (const widget of [raw.card?.widget,...(raw.pages??[]).flatMap(p=>[p.widget,p.appBar?.title,p.appBar?.actions])].filter((value):value is string=>typeof value==='string')) {
    if (!widgets.has(widget)) fail(`界面缺少组件 ${widget}`);
  }
  return {root,manifest:raw,entry,ui};
}
export async function typecheck(project:Project):Promise<void>{
  const config=await projectFile(project.root,'tsconfig.json');
  const compilerPackage=require.resolve('typescript/package.json');
  const compilerMeta=JSON.parse(await readFile(compilerPackage,'utf8'));
  const compiler=resolve(dirname(compilerPackage),compilerMeta.bin.tsc);
  await new Promise<void>((resolve,reject)=>{
    const child=spawn(process.execPath,[compiler,'--noEmit','--project',config],{cwd:project.root,stdio:'inherit',windowsHide:true});
    child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error('TypeScript 检查失败')));
  });
}
async function atomicWrite(path:string,content:string|Buffer){
  await mkdir(dirname(path),{recursive:true});
  const temp=path+'.'+randomUUID()+'.tmp';
  try{await writeFile(temp,content);await rename(temp,path);}finally{await rm(temp,{force:true});}
}
async function outputFile(root:string,path:string):Promise<string>{
  resourcePath(path);
  const target=resolve(root,'dist',path);
  await mkdir(dirname(target),{recursive:true});
  const parent=await realpath(dirname(target));
  const rel=relative(root,parent);
  if(isAbsolute(rel)||rel==='..'||rel.startsWith('..'+sep))fail('输出目录位于项目之外');
  return target;
}
export async function buildProject(directory:string):Promise<{project:Project;files:Record<string,string>}>{
  const project=await loadProject(directory);
  await typecheck(project);
  const result=await viteBuild({
    root:project.root,configFile:false,envDir:false,envPrefix:[],publicDir:false,logLevel:'warn',
    plugins:[neutralImports()],define:{'import.meta.hot':'undefined'},
    build:{write:false,minify:false,sourcemap:false,target:'es2020',
      lib:{entry:project.entry,formats:['iife'],name:'FluxdoPlugin'},
      rolldownOptions:{platform:'neutral',resolve:{mainFields:['module','main']},output:{codeSplitting:false}},
    },
  });
  const results=Array.isArray(result)?result:[result];
  const outputs=results.flatMap(r=>'output' in r?r.output:[]);
  const chunks=outputs.filter(o=>o.type==='chunk');
  if(chunks.length!==1||outputs.some(o=>o.type==='asset'))fail('插件须输出一个独立 JS 脚本，不能依赖 CSS 或外部资源文件');
  const chunk=chunks[0]!;
  if(chunk.imports.length||chunk.dynamicImports.length)fail('插件不能保留运行时外部导入');
  if(Buffer.byteLength(chunk.code)>contract.limits.scriptBytes)fail('构建脚本超过宿主容量限制');
  new Script(chunk.code,{filename:project.manifest.script});
  const files={[project.manifest.script]:chunk.code,[project.manifest.ui]:project.ui};
  // 全部校验成功后才写入产物，失败时保留上一次构建。
  for(const [name,text] of Object.entries(files))await atomicWrite(await outputFile(project.root,name),text);
  await atomicWrite(await outputFile(project.root,'plugin.json'),JSON.stringify(project.manifest,null,2)+'\n');
  return {project,files};
}
export async function packProject(directory:string,options:SigningOptions={}):Promise<{path:string;sha256:string;bytes:number}>{
  const {project,files}=await buildProject(directory);
  const bytes=Buffer.from(JSON.stringify(await signBundle({manifest:project.manifest,files},options)));
  if(bytes.length>contract.limits.bundleBytes)fail('插件包过大');
  const path=await outputFile(project.root,`${project.manifest.id}-${project.manifest.version}.fluxplugin`);
  await atomicWrite(path,bytes);
  return {path,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length};
}

/** 由实际构建产物生成市场草稿，提交仓库前仍由作者核对说明与截图。 */
export async function createMarketEntry(directory:string,repository:string,tag:string,options:SigningOptions & {channel?:string}={}){
  const repo=new URL(repository);
  if(repo.protocol!=='https:'||repo.hostname!=='github.com'||!/^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(repo.pathname)||repo.search||repo.hash||repo.username||repo.password)fail('仓库须为 GitHub HTTPS 地址');
  if(!tag||!/^[A-Za-z0-9._-]+$/.test(tag))fail('发布标签无效');
  const result=await packProject(directory,options);
  const project=await loadProject(directory);
  const m=project.manifest as Manifest & {description?:string;icon?:string};
  if(options.channel && !['stable','preview'].includes(options.channel))fail('发布渠道无效');
  if(options.channel==='stable'&&!!prerelease(m.version))fail('测试版本不能声明稳定渠道');
  const file=result.path.split(/[\\/]/).at(-1)!;
  const entry={id:m.id,name:m.name,version:m.version,apiVersion:m.apiVersion,author:m.author,
    summary:m.description??m.name,description:m.description??m.name,repository:repo.href.replace(/\/$/,''),
    packageUrl:repo.href.replace(/\/$/,'')+'/releases/download/'+tag+'/'+encodeURIComponent(file),
    channel:options.channel??(m.version.includes('-')?'preview':'stable'),sha256:result.sha256,icon:m.icon??'extension',categories:[],screenshots:[],changelog:'',requiredFeatures:m.requiredFeatures??[]};
  const path=await outputFile(project.root,'market-entry.json');await atomicWrite(path,JSON.stringify(entry,null,2)+'\n');
  return path;
}
