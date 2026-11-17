import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPluginHarness} from '@fluxdo/plugin-sdk/testing';
const script=await readFile(new URL('../dist/main.js',import.meta.url),'utf8');
test('确认后保存，取消时保持原值',async t=>{
 let approved=false;
 const host=createPluginHarness({script,initialStorage:{count:3},mocks:{
  'dialogs.confirm':()=>approved,'toast':()=>null,
 }});
 t.after(()=>host.close());
 await host.dispatch('card.load');assert.equal(host.data.s1.count,3);
 await host.dispatch('increment');assert.equal(host.storage.count,3);
 approved=true;await host.dispatch('increment');assert.equal(host.storage.count,4);
 assert.equal(host.logs.filter(l=>l.t==='error').length,0);
});
