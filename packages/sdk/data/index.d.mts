export class QueryCancelledError extends Error {}
type Json = null | boolean | number | string | Json[] | {[key:string]:Json};
export interface QueryState<T> {data:T|undefined;loading:boolean;error:string|null;stale:boolean}
export interface QueryClient {
  peek<T = Json>(key:Json):QueryState<T>;
  query<T extends Json>(key:Json,load:(context:{isCurrent():boolean})=>Promise<T>,options?:{ttl?:number;force?:boolean;tags?:string[]}):Promise<T>;
  update<T extends Json>(key:Json,update:(previous:T|undefined)=>T,options?:{ttl?:number;tags?:string[]}):void;
  invalidate(options?:{key?:Json;tags?:string[]}):void;
  subscribe(listener:(key:Json,state:QueryState<Json>)=>void):()=>void;
  setIdentity(identity:Json):void;clear():void;dispose():void;
}
export function createQueryClient(options?:{identity?:Json;maxEntries?:number;maxBytes?:number;now?:()=>number}):QueryClient;
export interface PagedState<T,C> {items:T[];nextCursor:C|null;loaded:boolean;loading:boolean;loadingMore:boolean;error:string|null}
export interface PagedList<T,C> {readonly state:PagedState<T,C>;reset(identity:Json):void;load(options?:{more?:boolean}):Promise<PagedState<T,C>>;update(update:(items:T[])=>T[]):void;cancel():void;dispose():void}
export function createPagedList<T extends Json,C extends Json = Json>(options:{load:(context:{cursor:C|null;identity:Json;isCurrent():boolean})=>Promise<{items:T[];nextCursor:C|null}>;itemKey:(item:T)=>Json;onChange?:(state:PagedState<T,C>)=>void}):PagedList<T,C>;
