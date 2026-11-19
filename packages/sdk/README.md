# @fluxdo/plugin-sdk

插件 API 2 的 TypeScript 全局类型、开发期 ImportMeta 类型、清单 schema 9 至 12 和宿主能力契约。只提供声明与数据，不包含账号、付款或网络的宿主实现。

在 tsconfig 的 compilerOptions.types 中加入 @fluxdo/plugin-sdk/dev，插件即可获得 fluxdo、上下文、存储、按需授权、Connect、支付和原生导航等公共 API 类型提示。类型定义不暴露 Node/DOM API。

contract.json 记录兼容版本、能力名称、容量和类型摘要（统一为 LF 换行后计算 SHA-256）。更新 SDK 后需与应用侧的预导脚本及开发中心覆盖测试一起验证，不能仅增加类型而不实现宿主方法。组件外观和完整 RFW 参数见应用内开发中心及应用仓库 docs/plugins/components.md。


@fluxdo/plugin-sdk/testing 提供 createPluginHarness({script,mocks,initialStorage})，用于 Node 测试。外部 API 必须提供显式模拟，未模拟调用会失败；它是测试工具，不是安全沙箱或生产宿主。测试包复用生产前导脚本并由宿主 CI 校验一致性。

@fluxdo/plugin-sdk/components 导出从生产组件生成的顶层参数清单。CLI 进行静态参数名检查；动态值和嵌套字段仍由运行时校验。fluxdo.on 返回撤销函数，开发运行器也会在模块替换后自动撤销旧注册。

0.6.0 新增 `cardNavigation`、`contentPresentation`。清单 `card.page` 指向普通页面时整卡可进入，卡片内按钮与菜单保持独立。展示组件含 Statistics、Amount、QuantityInput、Markdown、CopyButton，页面组件支持 toolbar，Image 支持 preview。
