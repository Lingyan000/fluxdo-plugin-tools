import {EventEmitter} from 'node:events';
import {builtinModules} from 'node:module';
import {realpath} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer, DevEnvironment} from 'vite';
import type {HotChannel, HotChannelClient, HotPayload, Plugin} from 'vite';

export interface DevConnection {
  /** 接收通过已配对连接传入的 Vite 自定义消息。 */
  receive(payload: unknown): void;
  close(): void;
}

export interface PluginDevServerOptions {
  root: string;
  onError?: (error: unknown) => void;
}

const nodeModules = new Set(builtinModules.flatMap(name => [name, `node:${name}`]));

export function neutralImports(): Plugin {
  return {
    name: 'fluxdo-neutral-imports', enforce: 'pre',
    resolveId(source) {
      if (nodeModules.has(source) || /^(?:node|https?|data):/.test(source)) {
        throw new Error(`插件开发运行时不支持此导入：${source}`);
      }
      return null;
    },
  };
}

/** 开发工具的模块服务；不监听网络端口，连接由 CLI 或宿主调试适配器提供。 */
export async function createPluginDevServer(options: PluginDevServerOptions) {
  const root = await realpath(resolve(options.root));
  const events = new EventEmitter();
  const clients = new Set<HotChannelClient>();
  let closed = false;
  const report = options.onError ?? (() => {});
  const channel: HotChannel = {
    send(payload) {
      for (const client of clients) {
        try { client.send(payload); } catch (error) { report(error); }
      }
    },
    on(event: string, listener: (...args: any[]) => void) { events.on(event, listener); },
    off(event: string, listener: (...args: any[]) => void) { events.off(event, listener); },
    close() { clients.clear(); },
  };
  const server = await createServer({
    root, configFile: false, envDir: false, envPrefix: [], appType: 'custom', logLevel: 'silent',
    plugins: [neutralImports()],
    server: {middlewareMode: true, ws: false, hmr: true, fs: {strict: true, allow: [root]}, watch: {awaitWriteFinish: {stabilityThreshold: 100, pollInterval: 20}}},
    environments: {
      fluxdo: {
        consumer: 'server', resolve: {noExternal: true, builtins: []},
        optimizeDeps: {noDiscovery: true, include: []},
        dev: {
          createEnvironment(name, config, context) {
            return new DevEnvironment(name, config, {...context, hot: true, transport: channel});
          },
        },
      },
    },
  });
  const environment = server.environments.fluxdo!;
  return {
    root,
    connect(send: (payload: HotPayload) => void): DevConnection {
      if (closed) throw new Error('开发模块服务已关闭');
      let active = true;
      const client: HotChannelClient = {send(payload) { if (active && !closed) send(payload); }};
      clients.add(client);
      events.emit('vite:client:connect', undefined, client);
      return {
        receive(payload: unknown) {
          if (!active || closed) throw new Error('开发连接已关闭');
          if (!payload || typeof payload !== 'object') throw new Error('开发消息格式无效');
          const message = payload as {type?: unknown; event?: unknown; data?: unknown};
          if (message.type !== 'custom' || typeof message.event !== 'string' || message.event.length > 128) {
            throw new Error('开发消息格式无效');
          }
          if (message.event === 'vite:invoke') {
            const request = message.data as {id?: unknown; name?: unknown; data?: unknown} | null;
            if (!request || typeof request.id !== 'string' || !request.id.startsWith('send:') ||
                request.id.length > 128 || !Array.isArray(request.data) ||
                (request.name !== 'fetchModule' && request.name !== 'getBuiltins')) {
              throw new Error('模块请求格式无效');
            }
            if (request.name === 'fetchModule' && typeof request.data[0] !== 'string') {
              throw new Error('模块地址无效');
            }
            // 不把任意方法名交给 Vite 的内部调用分发表。
            void environment.hot.handleInvoke(payload as HotPayload).then(response => {
              client.send({type: 'custom', event: 'vite:invoke', data: {
                name: request.name, id: request.id!.toString().replace('send:', 'response:'), data: response,
              }});
            }).catch(report);
          } else {
            events.emit(message.event, message.data, client);
          }
        },
        close() {
          if (!active) return;
          active = false;
          clients.delete(client);
          events.emit('vite:client:disconnect', undefined, client);
        },
      };
    },
    async close() {
      if (closed) return;
      closed = true;
      clients.clear();
      await server.close();
      events.removeAllListeners();
    },
  };
}
