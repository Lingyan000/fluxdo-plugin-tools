/** 显式翻译产品文案；服务端内容保持原样。 */
export function createTranslator(catalogs,baseLocale){
 if(!catalogs[baseLocale])throw Error('base_locale_missing');
 let locale=baseLocale;
 const select=value=>{const n=String(value).replaceAll('_','-').toLowerCase(),keys=Object.keys(catalogs);return keys.find(k=>k.toLowerCase().replaceAll('_','-')===n)||(/^zh-hant|^zh-tw/.test(n)?keys.find(k=>k.replaceAll('_','-').toLowerCase()==='zh-tw'):undefined)||keys.find(k=>k.toLowerCase()===n.split('-')[0])||baseLocale;};
 return {setLocale(value){locale=select(value);},get locale(){return locale;},text(key,values={}){const text=catalogs[locale]?.[key]??catalogs[baseLocale][key]??key;return text.replace(/\{([A-Za-z0-9_]+)\}/g,(raw,name)=>Object.hasOwn(values,name)?String(values[name]):raw);}};
}
