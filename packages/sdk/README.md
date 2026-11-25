# @fluxdo/plugin-sdk

插件 API 2 的 TypeScript 全局类型、开发期 ImportMeta 类型、清单 schema 9 至 12 和宿主能力契约。提供声明、契约与可选的纯 JavaScript 数据工具，不包含账号、付款或网络的宿主实现。

在 tsconfig 的 compilerOptions.types 中加入 @fluxdo/plugin-sdk/dev，插件即可获得 fluxdo、上下文、存储、按需授权、Connect、支付和原生导航等公共 API 类型提示。类型定义不暴露 Node/DOM API。

contract.json 记录兼容版本、能力名称、容量和类型摘要（统一为 LF 换行后计算 SHA-256）。更新 SDK 后需与应用侧的预导脚本及开发中心覆盖测试一起验证，不能仅增加类型而不实现宿主方法。组件外观和完整 RFW 参数见应用内开发中心及应用仓库 docs/plugins/components.md。


@fluxdo/plugin-sdk/testing 提供 createPluginHarness({script,mocks,initialStorage})，用于 Node 测试。外部 API 必须提供显式模拟，未模拟调用会失败；它是测试工具，不是安全沙箱或生产宿主。测试包复用生产前导脚本并由宿主 CI 校验一致性。

@fluxdo/plugin-sdk/components 导出从生产组件读取位置生成的参数、静态类型和嵌套字段契约。CLI 检查静态值并定位到组件、路径与行列；动态引用和不能可靠推导的类型仍由运行时校验。fluxdo.on 返回撤销函数，开发运行器也会在模块替换后自动撤销旧注册。

0.6.0 新增 `cardNavigation`、`contentPresentation`。清单 `card.page` 指向普通页面时整卡可进入，卡片内按钮与菜单保持独立。展示组件含 Statistics、Amount、QuantityInput、Markdown、CopyButton，页面组件支持 toolbar，Image 支持 preview。

0.7.0 增加 `eventStreams`、`ctx.api.streams.open/close`，以 `stream.event` 和 `stream.state` 接收事件和状态。流随界面隐藏暂停，连接复用现有网络与凭证权限；业务自行处理快照补查，系统通知单独申请授权。

0.8.0 增加 `host.environment()`、`preferences.get()`、`storage.migrate` 事件，以及 `host.environmentChanged` 和 `preferences.changed` 事件。清单声明 `dataVersion`、`preferences` 和相应必需能力；迁移在隔离存储副本中执行，不能联网或访问凭证。`createScenario` 为权限、账号、离线、凭证失效、宿主环境和偏好提供显式测试替身，虚拟计时器支持推进重试时间。

0.9.0 增加 `pageChrome`：清单页面的 `appBar.title` 与 `appBar.actions` 引用共享页面状态的 RFW 组件。按钮支持全宽，图标按钮支持加载、禁用、选中，统计支持骨架加载。

0.14.0 增加 `accountDataMigration` 和 `storage.partition` 类型，用于插件自行将旧公共数据归入账号分区。事件只在隔离迁移引擎执行，接收并返回数据副本，不会给运行中的插件开放跨账号存储。


## 查询缓存和分页

0.15.0 增加 storageScopes 与 extendedPages 类型。存储范围由清单显式声明，账号范围需要 identity 权限。默认范围只影响省略 options.scope 的调用，不允许越过清单访问其他范围。

数据工具从 @fluxdo/plugin-sdk/data 导入，可由 Vite 打包进最终脚本：

```ts
import {createQueryClient, createPagedList} from '@fluxdo/plugin-sdk/data';

const queries = createQueryClient({maxEntries: 64, maxBytes: 2 * 1024 * 1024});
// 开始当前账号的读取前更新身份；切换身份清空数据并使在途结果失效。
queries.setIdentity(accountId);
const items = await queries.query(['products', category], async () => {
  const response = await ctx.api.fetch(url);
  if (!response.ok) throw new Error('商品读取失败');
  return response.json();
}, {ttl: 30_000, tags: ['products']});

// 业务写入由调用者完成，只使受影响的读取失效。
queries.invalidate({tags: ['products']});
// 已知确切结果时可局部更新；订阅者获得最新状态。
queries.update(['products', category], previous => previous ?? []);

const pages = createPagedList({
  itemKey: (item: {id: string}) => item.id,
  load: async ({cursor, identity}) => readPage(identity, cursor),
  onChange: state => ctx.setData('list', state),
});
pages.reset([accountId, filter]);
await pages.load();
await pages.load({more: true});
// 离开页面时取消接收在途结果，销毁页面时释放控制器。
pages.cancel();
pages.dispose();
queries.dispose();
```

readPage 是插件自己的读取函数，须返回 {items, nextCursor}，末页返回 nextCursor: null。相同游标自动终止，列表按 itemKey 去重；刷新失败保留旧行，reset 在账号或筛选变化时清空行。查询结果只支持 JSON 数据，超出缓存预算会报 query_cache_limit。状态中的 error 为错误文字，loading 和 loadingMore 可驱动原生骨架与页脚。

取消是逻辑取消：旧响应不会写回数据，但已经发出的底层请求不保证物理中断。QueryCancelledError 通常在切换账号或离页时发生，应由业务忽略或转为中性状态。缓存不会持久化，也不会自动重试写操作；持久化仍使用受控 storage API。
