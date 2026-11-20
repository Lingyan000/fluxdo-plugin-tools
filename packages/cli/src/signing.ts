import {createHash,createPrivateKey,createPublicKey,sign,verify} from 'node:crypto';
import {readFile} from 'node:fs/promises';
export interface SigningOptions {key?:string;previousKey?:string}
function canonical(value:any):string {
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 if(typeof value==='number'&&!Number.isSafeInteger(value))throw new Error('签名清单只允许安全整数');
 return JSON.stringify(value);
}
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
function publicJwk(privateKey:ReturnType<typeof createPrivateKey>){
 const raw=createPublicKey(privateKey).export({format:'jwk'}),bits=privateKey.asymmetricKeyDetails?.modulusLength??0;
 if(raw.kty!=='RSA'||!raw.n||raw.e!=='AQAB'||bits<2048||bits>4096)throw new Error('签名需要 2048–4096 位 RSA 密钥，指数 65537');
 return {kty:'RSA',n:raw.n,e:raw.e};
}
export async function signBundle(bundle:any,options:SigningOptions={}){
 if(!options.key){if(options.previousKey)throw new Error('轮换需要新签名密钥');return bundle;}
 const privateKey=createPrivateKey(await readFile(options.key)),key=publicJwk(privateKey);
 const payload='fluxdo-package-v1\n'+hash(canonical(bundle.manifest))+'\n'+hash(bundle.files[bundle.manifest.ui])+'\n'+hash(bundle.files[bundle.manifest.script])+'\n';
 const signature=sign('RSA-SHA256',Buffer.from(payload),privateKey).toString('base64url');
 if(!verify('RSA-SHA256',Buffer.from(payload),createPublicKey(privateKey),Buffer.from(signature,'base64url')))throw new Error('签名自检失败');
 const publisher:any={algorithm:'RSA-SHA256',key,signature};
 if(options.previousKey){const previous=createPrivateKey(await readFile(options.previousKey));publisher.rotation={key:publicJwk(previous),signature:sign('RSA-SHA256',Buffer.from('fluxdo-key-v1\n'+hash(canonical(key))+'\n'),previous).toString('base64url')};}
 return {...bundle,publisher};
}
