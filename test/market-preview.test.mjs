import test from 'node:test';
import assert from 'node:assert/strict';
import {marketPreview} from '../packages/cli/dist/market-preview.mjs';
import {createHash} from 'node:crypto';
test('市场预览基于最终包的权限与规范公钥',()=>{
 const manifest={permissions:{identity:true,network:['api.example.org'],publicImages:true,connect:['https://api.example.org/callback']},links:[{host:'example.org'}],tasks:[{id:'sync'}]};
 const key={kty:'RSA',e:'AQAB',n:'test'};
 const preview=marketPreview({manifest,publisher:{key}});
 assert.deepEqual(preview.permissionsSummary,{permissions:['foregroundTasks','identity','links','network','publicImages','sandbox','serviceAccount'],networkHosts:['api.example.org'],linkHosts:['example.org']});
 assert.equal(preview.publisherKeyFingerprint,createHash('sha256').update(JSON.stringify({e:key.e,kty:key.kty,n:key.n})).digest('hex'));
 assert.equal(marketPreview({manifest}).publisherKeyFingerprint,null);
});
