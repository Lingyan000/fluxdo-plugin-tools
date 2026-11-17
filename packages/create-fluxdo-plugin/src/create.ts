import {mkdir,readFile,readdir,writeFile,rename,lstat,rm,mkdtemp} from 'node:fs/promises';
import {resolve,dirname,basename,join} from 'node:path';
import {fileURLToPath} from 'node:url';

export interface CreateOptions {directory:string;id?:string;name?:string;author?:string;template?:string}
const templates=fileURLToPath(new URL('../templates/',import.meta.url));
export async function templateNames():Promise<string[]>{return (await readdir(templates,{withFileTypes:true})).filter(v=>v.isDirectory()).map(v=>v.name).sort();}
export async function createPlugin(options:CreateOptions):Promise<string>{
  const target=resolve(options.directory);
  const slug=basename(target);
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>80)throw new Error('项目目录名须为小写英文、数字或短横线');
  const id=options.id??'example.'+slug.replaceAll('-','.');
  if(!/^[a-z0-9]+([._-][a-z0-9]+)+$/.test(id)||id.length>64)throw new Error('插件 ID 须为小写反向域名，最多 64 个字符');
  const name=options.name??slug,author=options.author??'插件作者';
  if(!name.trim()||name.length>40||!author.trim()||author.length>40)throw new Error('名称和作者须为 1–40 个字符');
  const template=options.template??'basic';
  if(!(await templateNames()).includes(template))throw new Error('未知模板：'+template);
  try{await lstat(target);throw new Error('目标目录已存在，请使用新目录；不会覆盖已有文件');}
  catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  await mkdir(dirname(target),{recursive:true});
  const staging=await mkdtemp(join(dirname(target),'.fluxdo-create-'));
  try{
    async function copy(source:string,dest:string){
      for(const entry of await readdir(source,{withFileTypes:true})){
        const output=join(dest,entry.name==='gitignore'?'.gitignore':entry.name);
        if(entry.isDirectory()){await mkdir(output);await copy(join(source,entry.name),output);}
        else if(entry.isFile())await writeFile(output,await readFile(join(source,entry.name)));
        else throw new Error('模板不得包含符号链接');
      }
    }
    await copy(join(templates,template),staging);
    const manifest=JSON.parse(await readFile(join(staging,'plugin.json'),'utf8'));
    Object.assign(manifest,{id,name,author});
    await writeFile(join(staging,'plugin.json'),JSON.stringify(manifest,null,2)+'\n');
    const packageJson=JSON.parse(await readFile(join(staging,'package.json'),'utf8'));packageJson.name=slug;
    await writeFile(join(staging,'package.json'),JSON.stringify(packageJson,null,2)+'\n');
    await rename(staging,target);
    return target;
  }catch(error){await rm(staging,{recursive:true,force:true});throw error;}
}
