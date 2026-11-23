/** 常见失败场景的显式测试替身，不替代设备端权限与网络验收。 */
export function createScenario({account={id:1,username:'demo'},permissions={},environment={locale:'zh',platform:'android',timeZoneOffsetMinutes:480},preferences={}}={}) {
 let current=account,offline=false,expired=false,systemNotifications='allowed';const grants={...permissions},responses=[],jobs=new Map();
 const deny=name=>{if(grants[name]!==true)throw new Error('permission_denied:'+name);};
 const mocks={
  'permissions.status':()=>({...grants}),
  'permissions.request':({names})=>names.every(n=>grants[n]===true),
  'user.get':()=>grants.identity?current:null,
  'host.environment':()=>({...environment}), 'preferences.get':()=>({...preferences}),
  'credentials.status':()=>({authorized:!!current&&!expired&&!!grants.serviceAccount,expiresAt:expired?1:null}),
  'forum.read':({resource})=>{deny(resource==='user'?'forumProfiles':resource==='following'?'forumFollowing':'forumActivity');if(!current||expired)throw new Error('forum_auth_required');return response();},
  'fetch':({credential})=>{if(credential){deny('serviceAccount');if(!current||expired)throw new Error('credential_expired');}return response();},
  'tasks.schedule':p=>{if(p.background)deny('background');jobs.set(p.id,{...p,nextAt:0,lastAt:null,lastSuccessAt:null,error:null});return true;},
  'tasks.list':()=>[...jobs.values()], 'tasks.cancel':({id})=>{jobs.delete(id);return null;},
  'notifications.status':()=>({authorized:!!grants.notifications,system:systemNotifications,canOpenSettings:true}),
  'notifications.openSettings':()=>true,
  'notifications.isAllowed':()=>!!grants.notifications,
  'notifications.requestPermission':()=>!!grants.notifications&&systemNotifications!=='denied',
  'notifications.show':()=>{deny('notifications');if(systemNotifications==='denied')throw new Error('notification_system_denied');return true;},
  'notifications.cancel':()=>null,
  'notifications.revoke':()=>{grants.notifications=false;return null;},
 };
 function response(){if(offline)throw new Error('network_unavailable');if(!responses.length)throw new Error('未配置响应');const r=responses.shift();if(r instanceof Error)throw r;return structuredClone(r);}
 return {mocks,notificationSystem:value=>{systemNotifications=value;},grant:(name,value=true)=>{grants[name]=value;},account:value=>{current=value;},offline:value=>{offline=value;},expire:value=>{expired=value;},respond:value=>responses.push(value),environment:value=>Object.assign(environment,value),preferences:value=>Object.assign(preferences,value)};
}
