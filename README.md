# FluxDO 插件工具

FluxDO 原生插件的 CLI、项目脚手架和 TypeScript SDK。插件作者只需 Node 24.11+，无需安装 Flutter 或克隆应用源码。

## 创建插件

0.3.0 通过 GitHub Release 分发三个独立 npm 格式包，尚未发布到 npm registry。

~~~sh
npx --yes --package=https://github.com/Lingyan000/fluxdo-plugin-tools/releases/download/v0.3.0/create-fluxdo-plugin-0.3.0.tgz create-fluxdo-plugin my-plugin --id com.example.myplugin
cd my-plugin
npm install
npm run check
npm test
npm run dev
# 发布时
npm run pack:plugin
~~~

也支持 pnpm。脚手架会把固定版本的 CLI 和 SDK Release 地址写入项目依赖。提交生成的 lockfile 后，可用 npm ci 或 pnpm install --frozen-lockfile 重现安装。

在 FluxDO 插件管理中导入 dist 目录的 .fluxplugin 文件。基础模板包含原生计数卡片、用户确认、存储与提示；默认不申请网络和账号权限。

## 仓库边界

| 包/目录 | 职责 |
| --- | --- |
| packages/cli | 检查、构建、测试、打包、设备配对；Vite 模块服务和开发运行器 |
| packages/create-fluxdo-plugin | 交互/非交互创建项目，模板随包发布 |
| packages/sdk | 公开 API 类型、清单和组件契约、模拟宿主测试工具 |
| test | 独立安装、生成项目、包格式和开发连接回归 |
| docs | 工具、协议和发布说明 |

Flutter、QuickJS 原生实现、RFW 渲染、权限和支付留在 [FluxDO 应用](https://github.com/Lingyan000/fluxdo)。GitHub 市场条目和具体服务插件留在 [fluxdo-plugins](https://github.com/Lingyan000/fluxdo-plugins)。

## 可用命令

- fluxdo check：TypeScript、清单、完整 RFW 语法与组件参数名检查。
- fluxdo build：生成单文件 JS、UI 描述和清单到 dist，失败保留旧产物。
- fluxdo pack：重新检查构建，生成 .fluxplugin 并输出 SHA-256。
- fluxdo test：构建后运行 test/*.test.mjs，模板已有确认、取消和存储测试。
- fluxdo market-entry --repository URL --tag TAG：生成包摘要与 GitHub 市场条目草稿。
- fluxdo doctor：检查 Node 环境。
- fluxdo dev：启动回环设备服务；在 App 开发中心粘贴配对地址。
- fluxdo dev --stdio：提供版本 1 的模块开发消息通道，供宿主适配器和集成测试连接。

Vite 负责开发模块依赖和 HMR；tsdown 构建工具自身；正式插件不携带 Vite。CLI 使用从应用编译的官方 RFW 解析器，并校验由生产组件导出的顶层参数名。动态值、嵌套对象的类型和真实布局仍在 App 预览中验证。

## App 原生预览

电脑启动 pnpm dev。在 FluxDO「插件管理 → 开发中心 → 连接开发工具」粘贴 CLI 输出的配对地址，审阅权限后启动临时实例。开发中心入口图标位于右上角。

Android 通过 USB 连接并运行 adb reverse tcp:5174 tcp:5174；桌面与开发工具在同一电脑直接连接。服务只监听 127.0.0.1，不需要局域网地址。端口可用 --port 指定，转发端口需要一致。当前不提供局域网无线连接或 iOS 真机配对。

保存 TS 后替换接受 HMR 的模块；保存 RFW 后更新原生组件库，保留页面数据。新模块成功执行后才移除旧事件和定时器。语法或界面校验失败保留上一版本；顶层业务副作用无法回滚，初始化应保持可重复执行。

异步事件、宿主调用、Connect 或支付未结束时暂缓自动更新。整图重载、断线恢复或清单变化需要 App 中重新审阅启动；不会自动重新执行入口。关闭开发会话会销毁引擎、临时数据和内存凭证，正式安装插件不受影响。

日志只回传当前开发运行实例，经应用统一脱敏，QuickJS 模块堆栈映射到 TS 源位置。普通插件不获得开发连接、Node、DOM 或自由联网能力。详见 [开发协议](docs/development-protocol.md)。

## 维护与验证

~~~sh
pnpm install --frozen-lockfile
pnpm test
pnpm pack:release
~~~

pnpm test 会把三个包制成实际 tgz，在仓库外安装脚手架和依赖，再执行创建、检查、构建、打包及模拟事件。无需 Dart；真实 QuickJS 回归由应用仓库的 tool/plugin_tools 执行。CI 对 Windows、macOS、Linux 运行同样的 Node 测试，另按 SDK 契约固定应用提交，运行真实 QuickJS 和 App 配对集成。

[发布流程](docs/releasing.md)说明三个包的版本联动、模板依赖、发布物校验及宿主兼容测试。

## 论坛与底栏页面

0.3.0 新增 schema 11 清单校验、`forum.read`/`forum.open` 类型和 [用户动态示例](examples/forum-activity/)。元宇宙首页与插件声明的页面都可由用户添加到底栏；开发会话只预览，不改正式导航。宿主需要支持 `navigationEntries` 与 `forumRead`。

示例使用当前账号读取发帖和回复，点击后打开原生话题。论坛数据请求必须来自可见页面的 `ctx.api`，只能使用清单批准的 `profiles`、`activity`、`following` 权限。业务名单、聚合与刷新策略由插件编写。具体协议和限流规则见 [宿主 API 文档](https://github.com/Lingyan000/fluxdo/blob/codex/ld-store-native-checkout/docs/plugins/api.md#论坛只读接口与原生导航)。
