export interface HarnessOptions {script:string;mocks?:Record<string,(params:any)=>unknown|Promise<unknown>>;initialStorage?:Record<string,unknown>}
export function createPluginHarness(options:HarnessOptions):{
 calls:Record<string,any>[];logs:Record<string,any>[];data:Record<string,Record<string,any>>;storage:Record<string,any>;
 dispatch(event:string,args?:Record<string,unknown>,surface?:{surface:string;kind:string;params?:Record<string,unknown>;page?:string}):Promise<void>;
 close():void;
};
