import http from 'node:http';
import https from 'node:https';
import {isIP} from 'node:net';
import {X509Certificate} from 'node:crypto';
/** 只查询已经配对的本地开发服务，不替换 App 的 WebSocket 会话。 */
export async function inspectDevice(pairing:string):Promise<Record<string,unknown>>{
 let url:URL;try{url=new URL(pairing);}catch{throw Error('配对地址无效');}
 const host=url.hostname,[a,b]=host.split('.').map(Number),key=url.searchParams.get('key'),cert=url.searchParams.get('cert');
 const loopback=host==='127.0.0.1';
 if(url.protocol!=='fluxdo-dev:'||url.username||url.password||url.hash||url.pathname||!url.port||!key||!/^[A-Za-z0-9_-]{32}$/.test(key)||
  isIP(host)!==4||!(loopback||a===10||a===192&&b===168||a===172&&b!>=16&&b!<=31)||(!loopback&&!cert)||
  (cert&&!/^[a-f0-9]{64}$/.test(cert))||[...url.searchParams.keys()].some(k=>!['key','cert'].includes(k))||url.searchParams.getAll('key').length!==1||url.searchParams.getAll('cert').length>1)throw Error('配对地址无效');
 return new Promise((resolve,reject)=>{
  // 非回环连接先在 TLS 握手核对已配对指纹，再写入认证头。
  let request:ReturnType<typeof http.request>;
  const options={hostname:host,port:Number(url.port),path:'/diagnostics',method:'GET',agent:false as const,headers:{Authorization:'Bearer '+key}};
  const onResponse=(response:http.IncomingMessage)=>{let text='';response.on('data',chunk=>{text+=chunk;if(Buffer.byteLength(text)>128*1024){request.destroy();reject(Error('检查响应过大'));}});response.on('end',()=>{try{if(response.statusCode!==200)throw Error('开发服务拒绝检查');resolve(JSON.parse(text));}catch{reject(Error('开发服务返回无效检查结果'));}});response.on('error',()=>reject(Error('检查连接中断')));};
  if(cert){
    request=https.request({...options,rejectUnauthorized:false},onResponse);
    request.on('socket',socket=>{socket.once('secureConnect',()=>{const raw=(socket as import('node:tls').TLSSocket).getPeerCertificate().raw;const actual=raw?new X509Certificate(raw).fingerprint256.replaceAll(':','').toLowerCase():'';if(actual!==cert){request.destroy();reject(Error('开发服务证书与配对指纹不一致'));}else request.end();});});
  }else{request=http.request(options,onResponse);request.end();}
  request.setTimeout(5000,()=>{request.destroy();reject(Error('无法连接开发服务；请检查同一网络或 adb reverse'));});request.on('error',()=>reject(Error('无法连接开发服务')));
 });
}
