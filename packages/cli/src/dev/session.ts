import {createServer} from 'node:http';
import {createServer as createSecureServer} from 'node:https';
import {isIP} from 'node:net';
import {networkInterfaces} from 'node:os';
import {generate} from 'selfsigned';
import {randomBytes, timingSafeEqual, X509Certificate} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {relative, resolve} from 'node:path';
import {WebSocketServer, WebSocket} from 'ws';
import {createPluginDevServer} from './server.js';
import {loadProject} from '../project.js';

export interface DeviceServerOptions {
  root: string;
  port?: number;
  lanHost?: string;
  onLog?: (entry: Record<string, unknown>) => void;
  onStatus?: (message: string) => void;
}
/** 默认监听回环；显式局域网模式使用每次启动生成的证书及指纹配对。 */
export async function createDeviceServer(options: DeviceServerOptions) {
  const host=options.lanHost??'127.0.0.1';
  if(options.lanHost){
    const [a,b]=host.split('.').map(Number);
    const local=isIP(host)===4&&(a===10||a===127||a===192&&b===168||a===172&&b!>=16&&b!<=31);
    if(!local||!Object.values(networkInterfaces()).flat().some(address=>address?.address===host))throw new Error('请使用本机局域网 IPv4 地址');
  }
  const initial = await loadProject(options.root);
  const token = randomBytes(24).toString('base64url');
  const session = randomBytes(16).toString('hex');
  const runner = await readFile(new URL('./runner.js', import.meta.url), 'utf8');
  let revision = 1, closed = false, active: WebSocket | undefined;
  let project = initial;
  const certificate=options.lanHost?await generate([{name:'commonName',value:'FluxDO plugin development'}],{
    keyType:'ec',curve:'P-256',algorithm:'sha256',notBeforeDate:new Date(Date.now()-60000),notAfterDate:new Date(Date.now()+24*3600000),
    extensions:[{name:'basicConstraints',cA:false},{name:'keyUsage',digitalSignature:true},{name:'extKeyUsage',serverAuth:true},{name:'subjectAltName',altNames:[{type:7,ip:host}]}],
  }):undefined;
  const fingerprint=certificate?new X509Certificate(certificate.cert).fingerprint256.replaceAll(':','').toLowerCase():undefined;
  const listener: import('node:http').RequestListener=(_request,response)=>{response.writeHead(404);response.end();};
  const http=certificate?createSecureServer({key:certificate.private,cert:certificate.cert,minVersion:'TLSv1.2'},listener):createServer(listener);
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
  try { await new Promise<void>((done,reject)=>{http.once('error',reject);http.listen(options.port??5174,host,done);}); }
  catch(error){await modules.close();sockets.close();throw error;}
  const port=(http.address() as {port:number}).port;
  const url=`fluxdo-dev://${host}:${port}?key=${token}${fingerprint?'&cert='+fingerprint:''}`;
  return {port,url,session,
    async close(){
      if(closed)return;closed=true;
      for(const ws of sockets.clients)ws.terminate();
      sockets.close(); await modules.close();
      await new Promise<void>(done=>http.close(()=>done()));
    },
  };
}
