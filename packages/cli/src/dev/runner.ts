import './polyfills.js';
import {ESModulesEvaluator, ModuleRunner} from 'vite/module-runner';
import type {ModuleRunnerTransport} from 'vite/module-runner';
import type {HotPayload} from 'vite';

export interface PluginModuleRunnerOptions {
  transport: ModuleRunnerTransport;
  /** 无法局部替换时，交由宿主安排插件重启，避免重放页面初始化操作。 */
  onReloadRequired: (payload: HotPayload) => void;
}

/** 在现有 QuickJS 内使用；网络、文件和宿主权限仍由原有桥接管理。 */
export function createPluginModuleRunner(options: PluginModuleRunnerOptions): ModuleRunner {
  if (!options.transport.connect || !options.transport.send) {
    throw new Error('插件热更新需要双向开发连接');
  }
  const evaluator = new ESModulesEvaluator();
  evaluator.runExternalModule = async (module) => {
    throw new Error(`开发运行时拒绝加载外部模块：${module}`);
  };
  return new ModuleRunner({
    transport: {
      ...options.transport,
      connect(handlers) {
        return options.transport.connect!({
          ...handlers!,
          onMessage(payload) {
            if (payload.type === 'full-reload') options.onReloadRequired(payload);
            else handlers?.onMessage(payload);
          },
        });
      },
    },
    // QuickJS 不提供 V8 的 Error.prepareStackTrace；调用方根据源映射转换日志。
    sourcemapInterceptor: false,
  }, evaluator);
}
