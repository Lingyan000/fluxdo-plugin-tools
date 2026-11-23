export {createScenario} from './scenarios.mjs';
import vm from 'node:vm';
import {isDeepStrictEqual} from 'node:util';
import {readFileSync} from 'node:fs';
const prelude=readFileSync(new URL('./prelude.js',import.meta.url),'utf8');
/** 插件作者的受控测试宿主。所有外部 API 必须显式模拟；不连接真实账号。 */
export function createPluginHarness({script,mocks={},initialStorage={},virtualTimers=false}){
  const calls=[],logs=[],data={},storage=structuredClone(initialStorage),timers=new Map();
  let taskResult;
  let closed=false,idleWaiters=[],pending=0,clock=0;
  const idle=()=>{if(pending===0){for(const done of idleWaiters)done();idleWaiters=[];}};
  const context=vm.createContext({sendMessage(_channel,raw){
    if(closed)return;
    const m=JSON.parse(raw);
    if(m.t==='task.done'){taskResult=m;return;}
    if(m.t==='event'){pending+=m.phase==='start'?1:-1;idle();return;}
    if(m.t==='log'||m.t==='error'){logs.push(m);return;}
    if(m.t==='data'){(data[m.s]??={})[m.k]=structuredClone(m.v);return;}
    if(m.t==='timer'){
      if(m.op==='clear'){if(!virtualTimers)clearTimeout(timers.get(m.id));timers.delete(m.id);}
      else if(virtualTimers)timers.set(m.id,{at:clock+Math.max(0,m.ms)});
      else timers.set(m.id,setTimeout(()=>{timers.delete(m.id);evaluate(`__fluxdoMetaverse.timer(${m.id})`);},Math.max(0,Math.min(m.ms,10000))));
      return;
    }
    if(m.t!=='call')return;
    calls.push(structuredClone(m));pending++;
    const run=async()=>{
      const fn=mocks[m.m];if(fn)return fn(m.p??{});
      switch(m.m){
        case 'storage.get':return storage[m.p.key]??null;
        case 'storage.compareAndSet':if(!isDeepStrictEqual(storage[m.p.key]??null,m.p.expected))return false;if(m.p.value===null)delete storage[m.p.key];else storage[m.p.key]=structuredClone(m.p.value);return true;
        case 'storage.set':storage[m.p.key]=structuredClone(m.p.value);return null;
        case 'storage.remove':delete storage[m.p.key];return null;
        case 'storage.setMany':for(const [key,value]of Object.entries(m.p.entries)){if(value===null)delete storage[key];else storage[key]=structuredClone(value);}return null;
        default:throw new Error('未提供 API 模拟：'+m.m);
      }
    };
    const settle=(ok,value)=>{if(!closed)evaluate(`__fluxdoMetaverse.settle(${m.id},${ok},${JSON.stringify(JSON.stringify(value??null))})`);};
    Promise.resolve().then(run).then(value=>settle(true,value),error=>settle(false,String(error.message??error))).finally(()=>{pending--;idle();});
  }});
  function evaluate(code){if(closed)throw new Error('测试实例已关闭');return vm.runInContext(code,context,{timeout:1000});}
  evaluate(prelude);evaluate(script);
  async function untilIdle(){
    if(pending===0)return;
    await new Promise((resolve,reject)=>{
      const done=()=>{clearTimeout(timer);resolve();};
      const timer=setTimeout(()=>{idleWaiters=idleWaiters.filter(w=>w!==done);reject(new Error('插件事件超时'));},3000);
      idleWaiters.push(done);idle();
    });
  }
  return {calls,logs,data,storage,
    async dispatch(event,args={},surface={surface:'s1',kind:'card',params:{}}){
      taskResult=undefined;
      evaluate(`__fluxdoMetaverse.dispatch(${JSON.stringify(event)},${JSON.stringify(JSON.stringify(surface))},${JSON.stringify(JSON.stringify(args))})`);
      await untilIdle();
      if(taskResult?.ok===false)throw new Error(taskResult.error);
      return taskResult?.result;
    },
    async advance(milliseconds){
      if(!virtualTimers||!Number.isFinite(milliseconds)||milliseconds<0)throw new Error('需要非负虚拟时间');
      clock+=milliseconds;const due=[...timers].filter(([,v])=>v.at<=clock);for(const [id]of due){timers.delete(id);evaluate('__fluxdoMetaverse.timer('+id+')');}
      await Promise.resolve();await untilIdle();
    },
    close(){closed=true;if(!virtualTimers)for(const timer of timers.values())clearTimeout(timer);timers.clear();},
  };
}
