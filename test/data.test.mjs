import test from 'node:test';
import assert from 'node:assert/strict';
import {createQueryClient,createPagedList,QueryCancelledError} from '../packages/sdk/data/index.mjs';
const deferred = () => {let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};};
test('同键合并、缓存命中、失败保留数据、失效只影响关联查询', async () => {
 let now=0,calls=0;const q=createQueryClient({now:()=>now});
 const load=async()=>{calls++;return {n:calls};};
 assert.deepEqual(await Promise.all([q.query(['orders',1],load,{ttl:100,tags:['orders']}),q.query(['orders',1],load)]),[{n:1},{n:1}]);
 await q.query(['orders',1],load);assert.equal(calls,1);
 await q.query('categories',async()=>[7],{ttl:100});
 q.invalidate({tags:['orders']});assert.equal(q.peek('categories').stale,false);
 await assert.rejects(q.query(['orders',1],async()=>{throw Error('offline')}),/offline/);
 assert.deepEqual(q.peek(['orders',1]).data,{n:1});assert.equal(q.peek(['orders',1]).loading,false);
 now=101;assert.equal(q.peek('categories').stale,true);q.dispose();
});
test('换账号、主动失效和更新阻止在途响应回写',async()=>{
 const q=createQueryClient({identity:1});
 for(const change of [()=>q.setIdentity(2),()=>q.invalidate({key:'x'}),()=>q.update('x',()=>9)]){
  const d=deferred(),p=q.query('x',()=>d.promise,{force:true});const rejected=assert.rejects(p,QueryCancelledError);await Promise.resolve();change();d.resolve(1);await rejected;assert.notEqual(q.peek('x').data,1);
 }
 q.dispose();assert.throws(()=>q.peek('x'),QueryCancelledError);
});
test('缓存数量和大小受限，调用者修改结果不污染缓存',async()=>{
 const q=createQueryClient({maxEntries:2,maxBytes:40});
 const data=await q.query('a',async()=>({v:1}));data.v=9;assert.equal(q.peek('a').data.v,1);
 await q.query('b',async()=>2);await q.query('c',async()=>3);assert.equal(q.peek('a').data,undefined);
 await assert.rejects(q.query('huge',async()=>'x'.repeat(50)),/query_cache_limit/);q.dispose();
});
test('分页刷新保留内容、去重更新、重复游标终止、切筛选拒绝迟到响应',async()=>{
 const calls=[],d=deferred();let hold=false;
 const list=createPagedList({itemKey:r=>r.id,load:async({cursor,identity})=>{calls.push({cursor,identity});if(hold)return d.promise;return cursor===null?{items:[{id:1,v:'old'}],nextCursor:2}:{items:[{id:1,v:'new'},{id:2}],nextCursor:2};}});
 list.reset('all');await list.load();await list.load({more:true});assert.equal(list.state.items.length,2);assert.equal(list.state.items[0].v,'new');assert.equal(list.state.nextCursor,null);
 hold=true;const p=list.load();const rejected=assert.rejects(p,QueryCancelledError);assert.equal(list.state.items.length,2);await Promise.resolve();list.reset('new');d.resolve({items:[{id:3}],nextCursor:null});await rejected;assert.deepEqual(list.state.items,[]);list.dispose();
});
test('分页失败不丢旧列表，取消后可以重新读取',async()=>{
 let fail=false;const list=createPagedList({itemKey:x=>x,load:async()=>{if(fail)throw Error('offline');return {items:[1],nextCursor:2};}});
 await list.load();fail=true;await assert.rejects(list.load({more:true}),/offline/);assert.deepEqual(list.state.items,[1]);assert.equal(list.state.loadingMore,false);assert.equal(list.state.nextCursor,2);list.cancel();fail=false;await list.load();assert.equal(list.state.error,null);list.dispose();
});

test('观察者失败不破坏结果、强制查询替换在途值，分页返回结束状态',async()=>{
 const old=console.error;console.error=()=>{};
 try {const q=createQueryClient();q.subscribe(()=>{throw Error('view gone')});
 const d=deferred(),p=q.query('a',()=>d.promise);const rejected=assert.rejects(p,QueryCancelledError);await Promise.resolve();
 assert.equal(await q.query('a',async()=>2,{force:true}),2);d.resolve(1);await rejected;assert.equal(q.peek('a').loading,false);
 assert.throws(()=>q.update('a',()=>3,{ttl:NaN}),/query_options_invalid/);
 const list=createPagedList({itemKey:x=>x,load:async()=>({items:[1],nextCursor:null}),onChange:()=>{throw Error('gone')}});
 assert.equal((await list.load()).loading,false);q.dispose();list.dispose();
 }finally{console.error=old;}
});
