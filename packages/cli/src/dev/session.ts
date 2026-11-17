import {createServer} from 'node:http';
import {randomBytes, timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {relative, resolve} from 'node:path';
import {WebSocketServer, WebSocket} from 'ws';
import {createPluginDevServer} from './server.js';
import {loadProject} from '../project.js';

export interface DeviceServerOptions {
  root: string;
  port?: number;
  onLog?: (entry: Record<string, unknown>) => void;
  onStatus?: (message: string) => void;
}
/** 只监听回环；手机使用 adb reverse。令牌不经过 HTTP URL、浏览器或持久化配置。 */
export async function createDeviceServer(options: DeviceServerOptions) {
  const initial = await loadProject(options.root);
  const token = randomBytes(24).toString('base64url');
  const session = randomBytes(16).toString('hex');
  const runner = await readFile(new URL('./runner.js', import.meta.url), 'utf8');
  let revision = 1, closed = false, active: WebSocket | undefined;
  let project = initial;
  const http = createServer((_request, response) => { response.writeHead(404); response.end(); });
  http.maxConnections = 8;
  http.requestTimeout = 10000;
  const sockets = new WebSocketServer({noServer: true, maxPayload: 1024 * 1024, perMessageDeflate: false});
  const send = (ws: WebSocket, packet: unknown) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 2 * 1024 * 1024) { ws.close(1009, 'slow consumer'); return; }
    ws.send(JSON.stringify(packet));
  };
  const modules = await createPluginDevServer({root: initial.root, onError: error => {
    options.onStatus?.(String(error));
    if (active) send(active, {type:'diagnostic', message:String(error).slice(0,4096)});
  }});
  const snapshot = (ws: WebSocket) => send(ws, {type:'project', protocolVersion:1, session, revision,
    manifest:project.manifest, ui:project.ui, runner,
    entry:'/'+relative(project.root, project.entry).replaceAll('\\','/')});
  http.on('upgrade', (request, socket, head) => {
    const supplied = Buffer.from(request.headers.authorization ?? '');
    const expected = Buffer.from('Bearer '+token);
    if (closed || request.url !== '/fluxdo' || request.headers.origin ||
        supplied.length !== expected.length || !timingSafeEqual(supplied,expected)) {
      socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n'); return;
    }
    sockets.handleUpgrade(request, socket, head, ws => sockets.emit('connection',ws));
  });
  sockets.on('connection', ws => {
    // 一个配对入口只有一个设备，重连撤销旧 transport，不跨设备广播调用结果。
    active?.close(4001,'replaced'); active = ws;
    options.onStatus?.('设备已连接');
    let count = 0;
    const budget = setInterval(()=>{count=0;},1000);
    const connection = modules.connect(payload => send(ws,{type:'vite',payload}));
    snapshot(ws);
    ws.on('message', (bytes,isBinary) => {
      try {
        if (isBinary || ++count>240) throw new Error('开发消息过多');
        const message = JSON.parse(bytes.toString());
        if (message?.type === 'vite') connection.receive(message.payload);
        else if (message?.type === 'sync') snapshot(ws);
        else if (message?.type === 'log' && message.entry && typeof message.entry==='object') {
          const entry = message.entry as Record<string,unknown>;
          if (entry.pluginId !== project.manifest.id) throw new Error('日志不属于当前插件');
          options.onLog?.({...entry, message: modules.mapStack(String(entry.message??''))});
        } else if (message?.type === 'status') options.onStatus?.(String(message.message).slice(0,4096));
        else throw new Error('未知开发消息');
      } catch (error) { send(ws,{type:'diagnostic',message:String(error)}); ws.close(1008,'invalid packet'); }
    });
    ws.on('error',()=>{});
    ws.on('close',()=>{clearInterval(budget);connection.close();if(active===ws){active=undefined;options.onStatus?.('设备已断开');}});
  });
  let refreshing = Promise.resolve();
  const changed = (file: string) => {
    if (![resolve(project.root,'plugin.json'),resolve(project.root,'fluxdo.config.json'),resolve(project.root,project.manifest.ui)].includes(resolve(file))) return;
    refreshing = refreshing.then(async()=>{
      try {
        const next = await loadProject(project.root);
        if (closed) return;
        const metadataChanged = JSON.stringify(next.manifest)!==JSON.stringify(project.manifest) || next.entry!==project.entry;
        project=next; revision++;
        if(active) {
          if(metadataChanged) snapshot(active);
          else send(active,{type:'ui',session,revision,ui:project.ui});
        }
      } catch(error) {
        options.onStatus?.(String(error));
        if(active) send(active,{type:'diagnostic',message:String(error)});
      }
    });
  };
  modules.watch(changed);
  try { await new Promise<void>((done,reject)=>{http.once('error',reject);http.listen(options.port??5174,'127.0.0.1',done);}); }
  catch(error){await modules.close();sockets.close();throw error;}
  const port=(http.address() as {port:number}).port;
  const url=`fluxdo-dev://127.0.0.1:${port}?key=${token}`;
  return {port,url,session,
    async close(){
      if(closed)return;closed=true;
      for(const ws of sockets.clients)ws.terminate();
      sockets.close(); await modules.close();
      await new Promise<void>(done=>http.close(()=>done()));
    },
  };
}
