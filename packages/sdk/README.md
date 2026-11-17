# @fluxdo/plugin-sdk

插件 API 2 的 TypeScript 全局类型、开发期 ImportMeta 类型、清单 schema 9/10 和宿主能力契约。只提供声明与数据，不包含账号、付款或网络的宿主实现。

在 tsconfig 的 compilerOptions.types 中加入 @fluxdo/plugin-sdk/dev，插件即可获得 fluxdo、上下文、存储、确认、Connect、支付和原生导航等公共 API 类型提示。类型定义不暴露 Node/DOM API。

contract.json 记录兼容版本、能力名称、容量和类型摘要（统一为 LF 换行后计算 SHA-256）。更新 SDK 后需与应用侧的预导脚本及开发中心覆盖测试一起验证，不能仅增加类型而不实现宿主方法。组件外观和完整 RFW 参数见应用内开发中心及应用仓库 docs/plugins/components.md。
