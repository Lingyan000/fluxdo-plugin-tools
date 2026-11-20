fluxdo.on('storage.migrate', async (ctx, args) => {
  if (args.fromVersion === 1) {
    const items = await ctx.api.storage.get<FluxDO.Json[]>('oldItems') ?? [];
    await ctx.api.storage.setMany({items, oldItems: null});
  }
});
async function render(ctx: FluxDO.Context) {
  const environment = await ctx.api.host.environment();
  const preferences = await ctx.api.preferences.get();
  ctx.setData('title', environment.locale.startsWith('en') ? 'Saved items' : '已保存条目');
  const items = await ctx.api.storage.get<FluxDO.Json[]>('items') ?? [];
  ctx.setData('items', preferences.compact ? String(items.length) : JSON.stringify(items));
}
fluxdo.on('card.load', render);
fluxdo.on('preferences.changed', render);
fluxdo.on('host.environmentChanged', render);
