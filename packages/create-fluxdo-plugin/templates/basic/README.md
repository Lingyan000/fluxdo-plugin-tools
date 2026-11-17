# FluxDO 原生插件

使用 Node 24.11+，无需安装 Flutter 或克隆 FluxDO。

```sh
pnpm install
pnpm check
pnpm build
pnpm pack:plugin
```

在 FluxDO 的插件管理中导入 dist 内的 `.fluxplugin`。示例卡片提供计数、原生确认与提示。

- `plugin.json`：身份、页面、权限和所需宿主能力。
- `src/main.ts`：业务和事件处理。不要使用 Node/DOM API。
- `ui.rfwtxt`：原生 UI 描述；完整语法与组件参数由宿主安装校验。
- `fluxdo.config.json`：源码入口。

工具与 SDK 暂通过固定版本 GitHub Release 包分发，锁定依赖后请提交 lockfile。`pnpm dev` 当前提供标准流模块协议，供宿主适配器/测试连接；手机扫码连接尚未接入，不能直接用它连接已发布的 App。

构建不执行业务脚本或自动访问真实账号。是否增加授权、付款权限应由实际业务决定。
