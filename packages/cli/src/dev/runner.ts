import './polyfills.js';
import {ESModulesEvaluator, ModuleRunner, ssrImportMetaKey} from 'vite/module-runner';
import type {ModuleRunnerTransport, ModuleEvaluator} from 'vite/module-runner';
import type {HotPayload} from 'vite';

export interface PluginModuleRunnerOptions {
  transport: ModuleRunnerTransport;
  /** 无法局部替换时，交由宿主安排插件重启，避免重放页面初始化操作。 */
  onReloadRequired: (payload: HotPayload) => void;
  onUpdate?: (phase: 'before' | 'after') => void;
}

/** 在现有 QuickJS 内使用；网络、文件和宿主权限仍由原有桥接管理。 */
export function createPluginModuleRunner(options: PluginModuleRunnerOptions): ModuleRunner {
  if (!options.transport.connect || !options.transport.send) {
    throw new Error('插件热更新需要双向开发连接');
  }
  const scopes = new Map<string, ReturnType<typeof createModuleScope>>();
  const fallback = new ESModulesEvaluator();
  const native = (globalThis as any).__fluxdoEvaluateModule;
  const evaluator: ModuleEvaluator = {
    startOffset: native ? 1 : fallback.startOffset,
    runExternalModule: async (module) => {throw new Error(`开发运行时拒绝加载外部模块：${module}`);},
    async runInlinedModule(context, code, module) {
    const meta = context[ssrImportMetaKey] as any;
    const scope = createModuleScope();
    meta.fluxdoScope = scope;
    meta.hot?.prune(() => {scope.dispose();scopes.delete(module.id);});
    meta.hot?.on('vite:afterUpdate', () => options.onUpdate?.('after'));
    try {
      const scoped = 'const {fluxdo,setTimeout,clearTimeout}=__vite_ssr_import_meta__.fluxdoScope;'+code;
      if (native) await native(context,scoped,module.id);
      else await fallback.runInlinedModule(context,scoped);
      scopes.get(module.id)?.dispose();
      scope.commit();
      scopes.set(module.id,scope);
    } catch (error) {scope.dispose();throw error;}
    },
  };
  const runner = new ModuleRunner({
    transport: {
      ...options.transport,
      connect(handlers) {
        return options.transport.connect!({
          ...handlers!,
          onMessage(payload) {
            if (payload.type === 'full-reload') options.onReloadRequired(payload);
            else {
              if (payload.type === 'update') options.onUpdate?.('before');
              handlers?.onMessage(payload);
            }
          },
        });
      },
    },
    // QuickJS 不提供 V8 的 Error.prepareStackTrace；调用方根据源映射转换日志。
    sourcemapInterceptor: false,
  }, evaluator);
  return runner;
}

/** 旧模块的事件、定时器及迟到异步回调不会继续写入新界面。 */
function createModuleScope() {
  const raw = (globalThis as any).fluxdo;
  let active = true, committed = false;
  const registrations: (() => void)[] = [];
  const disposers: (() => void)[] = [];
  const timers = new Set<number>();
  const timeout = globalThis.setTimeout;
  const clear = globalThis.clearTimeout;
  const guard = () => {if (!active) throw new Error('module_disposed');};
  const wrapApi = (api: any): any => new Proxy(api, {
    get(target, name) {
      const value = target[name];
      if (name === 'on') return (event: string, handler: (...args: any[]) => any) => {
        guard();
        let off: (() => void) | undefined;
        let cancelled = false;
        const register = () => {
          if (cancelled) return;
          off = target.on(event, (ctx: any, ...args: any[]) => {
            if (!active) return;
            const scoped = {...ctx, api:wrapApi(facade(ctx.api)),setData:(...values:any[])=>{if(active)ctx.setData(...values);}};
            return handler(scoped,...args);
          });
        };
        const remove = () => {cancelled=true;off?.();};
        if (committed) register(); else registrations.push(register);
        disposers.push(remove);
        return remove;
      };
      if (value && typeof value === 'object') return wrapApi(value);
      if (typeof value !== 'function') return value;
      return (...args: any[]) => {
        guard();
        const result = value.apply(target,args);
        return result && typeof result.then === 'function' ? result.then((data:unknown)=>{guard();return data;}) : result;
      };
    },
  });
  // 冻结 SDK 的 Proxy 不能返回不同属性值；从可扩展镜像读取方法。
  const facade = (api:any):any => {
    const copy:any={};
    for(const key of Object.keys(api)) copy[key]=api[key] && typeof api[key]==='object'?facade(api[key]):api[key];
    return copy;
  };
  return {
    commit(){committed=true;for(const register of registrations)register();registrations.length=0;},
    fluxdo:wrapApi(facade(raw)),
    setTimeout(fn:(...args:any[])=>void, ms?:number, ...args:any[]) {
      guard();
      const id=timeout(()=>{timers.delete(id);if(active)fn(...args);},ms) as unknown as number;
      timers.add(id); return id;
    },
    clearTimeout(id:number){timers.delete(id);clear(id);},
    dispose(){active=false;for(const id of timers)clear(id);timers.clear();for(const off of disposers)off();disposers.length=0;},
  };
}
