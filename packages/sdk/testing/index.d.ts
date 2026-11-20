export interface HarnessOptions {script:string;mocks?:Record<string,(params:any)=>unknown|Promise<unknown>>;initialStorage?:Record<string,unknown>;virtualTimers?:boolean}
export function createPluginHarness(options:HarnessOptions):{
 calls:Record<string,any>[];logs:Record<string,any>[];data:Record<string,Record<string,any>>;storage:Record<string,any>;
 dispatch(event:string,args?:Record<string,unknown>,surface?:{surface:string;kind:string;params?:Record<string,unknown>;page?:string}):Promise<void>;
 advance(milliseconds:number):Promise<void>;
 close():void;
};

export function createScenario(options?:{account?:{id:number;username:string}|null;permissions?:Record<string,boolean>;environment?:{locale:string;platform:string;timeZoneOffsetMinutes:number};preferences?:Record<string,unknown>}):{
 mocks:Record<string,(params:any)=>unknown>;grant(name:string,value?:boolean):void;account(value:{id:number;username:string}|null):void;
 offline(value:boolean):void;expire(value:boolean):void;respond(value:unknown):void;environment(value:Record<string,unknown>):void;preferences(value:Record<string,unknown>):void;
};
