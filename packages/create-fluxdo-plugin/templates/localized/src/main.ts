import {createTranslator} from '@fluxdo/plugin-sdk/i18n';
const t=createTranslator({zh:{count:'计数：{count}',increment:'增加计数'},en:{count:'Count: {count}',increment:'Increment'}},'zh');
async function render(ctx:FluxDO.Context){t.setLocale((await ctx.api.host.environment()).locale);ctx.setData('title',t.text('count',{count:await ctx.api.storage.get<number>('count')??0}));ctx.setData('action',t.text('increment'));}
fluxdo.on('card.load',render);
fluxdo.on('host.environmentChanged',render);
fluxdo.on('increment',async ctx=>{await ctx.api.storage.set('count',(await ctx.api.storage.get<number>('count')??0)+1);await render(ctx);});
if(import.meta.hot)import.meta.hot.accept();
