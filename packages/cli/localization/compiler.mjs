import {parse} from 'acorn';
import {createHash} from 'node:crypto';
import {Converter} from 'opencc-js';
import {readFileSync,writeFileSync,readdirSync,realpathSync,existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve,relative,isAbsolute} from 'node:path';
import {transformWithOxc} from 'vite';

// 只标记源码中的产品文案，服务器返回的标题、正文、用户名不参与翻译。
export async function localizeProject(directory,{check=false}={}){
  const root=realpathSync(directory);const dir=pathToFileURL(root+'/');
  function within(file){const value=relative(root,realpathSync(file));if(isAbsolute(value)||value==='..'||value.startsWith('..'+String.fromCharCode(92))||value.startsWith('../'))throw Error('本地化资源必须位于项目内');return file;}
  const read=file=>readFileSync(within(file),'utf8');
  const write=(file,value)=>{within(new URL('./',file));if(existsSync(file)){within(file);if(readFileSync(file,'utf8')===value)return;}writeFileSync(file,value);};
  const id=directory;
  const config=JSON.parse(read(new URL('fluxdo.config.json',dir)));
  const settings=config.localization;
  if(!settings)throw Error('请在 fluxdo.config.json 声明 localization');
  for(const field of ['script','ui']){const value=settings[field];if(typeof value!=='string'||!value||/[:?#\\]/.test(value)||value.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('本地化源码须为项目内相对路径');}
  const baseLocale=settings.baseLocale||'zh';
  const input=read(new URL(settings.script,dir));
  const source=settings.script.endsWith('.ts')?(await transformWithOxc(input,settings.script,{target:'es2020'})).code:input;
  const ui=read(new URL(settings.ui,dir));
  const manifest=JSON.parse(read(new URL('plugin.json',dir)));
  manifest.requiredFeatures??=[];
  if(manifest.script===settings.script||manifest.ui===settings.ui)throw Error('本地化源码与产物必须分离');
  for(const name of [manifest.script,manifest.ui])if(typeof name!=='string'||!/^[A-Za-z0-9_.-]+$/.test(name)||name==='plugin.json'||name==='.'||name==='..')throw Error('本地化输出须为项目根目录资源');
  const dictionaries=Object.fromEntries(readdirSync(new URL('locales/',dir)).filter(name=>/^[a-z]{2,3}(?:[-_][A-Za-z0-9]{2,8}){0,2}\.json$/.test(name)).map(name=>[name.slice(0,-5),JSON.parse(read(new URL('locales/'+name,dir)))]));
  const known=new Set(Object.values(dictionaries).flatMap(dict=>Object.keys(dict)));
  const isText=text=>known.has(text)||(baseLocale==='zh'&&/[\u3400-\u9fff]/.test(text));
  const keys=new Map(),strings=[];
  function key(text){if(!keys.has(text)){keys.set(text,'s'+createHash('sha256').update(text).digest('hex').slice(0,16));strings.push(text);}return keys.get(text);}
  function transform(node){
    if(node.type==='Literal'&&typeof node.value==='string'&&isText(node.value)){
      return '__text('+JSON.stringify(key(node.value))+')';
    }
    if(node.type==='TemplateLiteral'&&(node.quasis.some(q=>isText(q.value.cooked))||known.has(node.quasis.map((q,i)=>q.value.cooked+(i<node.expressions.length?'{'+i+'}':'')).join('')))){
      const parts=node.quasis.map((q,i)=>q.value.cooked+(i<node.expressions.length?'{'+i+'}':''));
      // 模板参数保持原样，由显示时展开，内容不会二次当作语言键处理。
      return '__text('+JSON.stringify(key(parts.join('')))+', ['+node.expressions.map(transform).join(', ')+'])';
    }
    const children=Object.values(node).flatMap(child=>Array.isArray(child)?child.filter(x=>x?.type):child?.type?[child]:[]);
    let text=source.slice(node.start,node.end);
    for(const child of children.sort((a,b)=>b.start-a.start))text=text.slice(0,child.start-node.start)+transform(child)+text.slice(child.end-node.start);
    return text;
  }
  const tree=parse(source,{ecmaVersion:'latest',sourceType:'module'});
  if(tree.body.some(node=>node.type.startsWith('Import')||node.type.startsWith('Export')))throw Error('带模块导入的项目请使用 @fluxdo/plugin-sdk/i18n；localize 只编译独立脚本');
  const code=transform(tree);
  let outputUi=ui.replace(/"([^"\n]*)"/g,(whole,text)=>isText(text)?'data.i18n.'+key(text):whole);
  const titles=Object.fromEntries((manifest.pages||[]).map(p=>[p.id,key(p.title)]));
  const fields={name:manifest.name,description:manifest.description,...Object.fromEntries((manifest.pages||[]).flatMap(p=>[['pages.'+p.id+'.title',p.title],...(p.navigation?[['pages.'+p.id+'.navigation.label',p.navigation.label]]:[])])),...Object.fromEntries((manifest.tasks||[]).map(t=>['tasks.'+t.id+'.title',t.title])),...Object.fromEntries((manifest.preferences||[]).flatMap(p=>[['preferences.'+p.key+'.title',p.title],...Object.entries(p.options||{}).map(([key,text])=>['preferences.'+p.key+'.options.'+key,text])]))};
  for(const text of Object.values(fields))if(text)key(text);
  const conversions={[baseLocale]:x=>dictionaries[baseLocale]?.[x]??x};
  for(const [locale,dictionary]of Object.entries(dictionaries))if(locale!==baseLocale)conversions[locale]=text=>{if(typeof dictionary[text]!=='string'||!dictionary[text])throw Error(locale+' 缺少文案：'+text);return dictionary[text];};
  if(baseLocale==='zh'){conversions.zh_TW??=Converter({from:'cn',to:'twp'});conversions.zh_HK??=Converter({from:'cn',to:'hk'});}
  const catalogs=Object.fromEntries(Object.entries(conversions).map(([locale,convert])=>[locale,Object.fromEntries(strings.map(text=>[keys.get(text),convert(text)]))]));
  manifest.locales=Object.fromEntries(Object.entries(conversions).filter(([locale])=>locale!==baseLocale).map(([locale,convert])=>[locale,Object.fromEntries(Object.entries(fields).filter(([,text])=>text).map(([field,text])=>[field,convert(text)]))]));
  if(!manifest.requiredFeatures.includes('manifestLocalization'))manifest.requiredFeatures.push('manifestLocalization');
  const helpers=config.runtimeHelpers??[];
  if(!Array.isArray(helpers)||helpers.some(name=>name!=='data')||new Set(helpers).size!==helpers.length)throw Error('runtimeHelpers 只支持 data');
  const helperCode=helpers.includes('data')?'const fluxdoData=(()=>{'+readFileSync(new URL('./data.mjs',import.meta.url),'utf8').replace(/^export /gm,'')+'\nreturn {createQueryClient,createPagedList,QueryCancelledError};})();\n':'';
  const runtime=`// 此文件由 fluxdo localize 生成，业务源码与翻译见 src/、locales/。
((host)=>{
 const catalogs=${JSON.stringify(catalogs)},titles=${JSON.stringify(titles)};
 let locale=${JSON.stringify(baseLocale)},localeTask=null;const contexts=new Map(),records=new Map();
 // 文案标记只用于显示，稳定键可随缓存跨版本保留。
 const prefix='\\uE000fluxdo-text:',suffix='\\uE001';
 function __text(key,args=[]){return prefix+key+(args.length?':'+encodeURIComponent(JSON.stringify(args)):'')+suffix;}
 function resolve(text,depth=0){if(typeof text!=='string'||depth>4)return text;return text.replace(/\\uE000fluxdo-text:([a-z0-9]+)(?::([^\\uE001]*))?\\uE001/g,(_,key,raw)=>{let value=catalogs[locale][key]||catalogs[${JSON.stringify(baseLocale)}][key]||'';if(raw){let args;try{args=JSON.parse(decodeURIComponent(raw));}catch(_){return '';}value=value.replace(/\\{(\\d+)\\}/g,(_,index)=>resolve(String(args[Number(index)]??''),depth+1));}return value;});}
 function translate(value){if(typeof value==='string')return resolve(value);if(Array.isArray(value))return value.map(translate);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,translate(v)]));return value;}
 async function environment(api){if(!api.host?.environment)return;const env=await api.host.environment();const name=String(env.locale||'').replaceAll('-','_').toLowerCase();const names=Object.keys(catalogs);locale=names.find(key=>key.toLowerCase()===name)||(/^zh_(hant|tw)/i.test(name)?names.find(key=>key==='zh_TW'):undefined)||names.find(key=>key.toLowerCase()===name.split('_')[0])||${JSON.stringify(baseLocale)};}
 function client(api){return {...api,toast:(...args)=>api.toast(...args.map(translate)),dialogs:api.dialogs&&{...api.dialogs,confirm:options=>api.dialogs.confirm(translate(options))},notifications:api.notifications&&{...api.notifications,show:options=>api.notifications.show(translate(options))}};}
 function wrap(ctx){if(typeof ctx.setData!=='function')return {...ctx,api:client(ctx.api)};contexts.set(ctx.surface,ctx);const data=records.get(ctx.surface)||new Map();records.set(ctx.surface,data);ctx.setData('i18n',catalogs[locale]);ctx.setData('pageTitle',data.has('pageTitle')?translate(data.get('pageTitle')):catalogs[locale][titles[ctx.page]]||'');return {...ctx,api:client(ctx.api),setData:(key,value)=>{data.set(key,value);ctx.setData(key,translate(value));}};}
 const fluxdo={...client(host),on:(name,fn)=>host.on(name,async(ctx,args)=>{try{if(ctx.api.host?.environment)await (localeTask??=environment(ctx.api).catch(()=>{}));if(name==='page.resume'||name==='card.resume'){await environment(ctx.api);const source=contexts.get(ctx.surface);if(source)for(const [key,value]of records.get(ctx.surface)||[])source.setData(key,translate(value));}return await fn(wrap(ctx),args);}finally{if(name==='surface.close'){contexts.delete(ctx.surface);records.delete(ctx.surface);}}})};
 ${helperCode}${code}
 host.on('host.environmentChanged',async ctx=>{await environment(ctx.api);for(const [id,source]of contexts){source.setData('i18n',catalogs[locale]);source.setData('pageTitle',catalogs[locale][titles[source.page]]||'');for(const [key,value]of records.get(id)||[])source.setData(key,translate(value));}});
})(fluxdo);
`;
  outputUi+='\nwidget LocalizedTitle = Label(text: data.pageTitle, style: "titleLarge", maxLines: 1);\n';
  for(const page of manifest.pages||[])page.appBar={...page.appBar,title:'LocalizedTitle'};
  for(const feature of ['hostEnvironment','pageChrome'])if(!manifest.requiredFeatures.includes(feature))manifest.requiredFeatures.push(feature);
  if(check){
    if(read(new URL(manifest.script,dir))!==runtime||read(new URL(manifest.ui,dir))!==outputUi||read(new URL('locales/catalogs.json',dir))!==JSON.stringify(catalogs,null,2)+'\n'||read(new URL('plugin.json',dir))!==JSON.stringify(manifest,null,2)+'\n')throw Error(id+' 本地化产物需要更新');
  }else{
    write(new URL('locales/catalogs.json',dir),JSON.stringify(catalogs,null,2)+'\n');write(new URL(manifest.script,dir),runtime);write(new URL(manifest.ui,dir),outputUi);write(new URL('plugin.json',dir),JSON.stringify(manifest,null,2)+'\n');
  }
  return {strings:strings.length,locales:Object.keys(catalogs)};
}
