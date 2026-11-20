import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createPublicKey,verify,createHash} from 'node:crypto';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {signBundle} from '../packages/cli/dist/signing.mjs';
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
const hash=v=>createHash('sha256').update(v).digest('hex');
test('资源摘要签名、篡改拒绝与旧密钥授权轮换',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'plugin-signing-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const keys=[];for(const name of ['old','next']){const pair=generateKeyPairSync('rsa',{modulusLength:2048});const path=join(dir,name+'.pem');await writeFile(path,pair.privateKey.export({type:'pkcs8',format:'pem'}));keys.push(path);}
 const bundle={manifest:{schema:12,apiVersion:2,id:'example.signed',name:'签名测试',author:'example',version:'1.0.0',ui:'ui.rfwtxt',script:'main.js',permissions:{network:[]},card:{widget:'Card'}},files:{'ui.rfwtxt':'import fluxdo; widget Card = Gap();','main.js':'fluxdo.on("card.load",()=>{});'}};
 const signed=await signBundle(bundle,{key:keys[0]});
 const payload='fluxdo-package-v1\n'+hash(canonical(bundle.manifest))+'\n'+hash(bundle.files['ui.rfwtxt'])+'\n'+hash(bundle.files['main.js'])+'\n';
 const key=createPublicKey({key:signed.publisher.key,format:'jwk'});
 assert.ok(verify('RSA-SHA256',Buffer.from(payload),key,Buffer.from(signed.publisher.signature,'base64url')));
 assert.equal(verify('RSA-SHA256',Buffer.from(payload+'changed'),key,Buffer.from(signed.publisher.signature,'base64url')),false);
 const rotated=await signBundle({...bundle,manifest:{...bundle.manifest,version:'1.1.0'}},{key:keys[1],previousKey:keys[0]});
 assert.ok(verify('RSA-SHA256',Buffer.from('fluxdo-key-v1\n'+hash(canonical(rotated.publisher.key))+'\n'),key,Buffer.from(rotated.publisher.rotation.signature,'base64url')));
 assert.deepEqual(await signBundle(bundle),bundle);
 await assert.rejects(signBundle(bundle,{previousKey:keys[0]}));
 if(process.env.FLUXDO_WRITE_SIGNATURE_FIXTURE){await writeFile(resolve(process.env.FLUXDO_WRITE_SIGNATURE_FIXTURE),JSON.stringify({signed,rotated},null,2)+'\n');}
});
