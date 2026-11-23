# FluxDO 插件工具

FluxDO 原生插件的 CLI、项目脚手架和 TypeScript SDK。插件作者只需 Node 24.11+，无需安装 Flutter 或克隆应用源码。

## 创建插件

0.13.0 通过 GitHub Release 分发三个独立 npm 格式包，尚未发布到 npm registry。

~~~sh
npx --yes --package=https://github.com/Lingyan000/fluxdo-plugin-tools/releases/download/v0.13.0/create-fluxdo-plugin-0.13.0.tgz create-fluxdo-plugin my-plugin --id com.example.myplugin
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

Vite 负责开发模块依赖和 HMR；tsdown 构建工具自身；正式插件不携带 Vite。CLI 使用从应用编译的官方 RFW 解析器，并校验从生产组件读取位置导出的参数名、静态类型和嵌套字段，错误定位到组件、路径与行列。动态值和真实布局仍在 App 预览中验证。

## App 原生预览

电脑启动 pnpm dev。在 FluxDO「插件管理 → 开发中心 → 连接开发工具」粘贴 CLI 输出的配对地址，审阅权限后启动临时实例。开发中心入口图标位于右上角。

默认服务监听 127.0.0.1：Android 通过 USB 连接并运行 adb reverse tcp:5174 tcp:5174，桌面与开发工具在同一电脑直接连接。端口可用 --port 指定，转发端口需要一致。Android、iOS 和桌面的无线连接见下方「加密无线配对」；iOS 真机验收仍待完成。

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

按需授权支持、自适应集合组件和表单完成后关闭当前弹层的能力。可先调用 `ctx.api.permissions.status()`，在用户选择功能时用 `request()` 申请缺少的范围。详见[权限与返回值](https://github.com/Lingyan000/fluxdo/blob/codex/ld-store-native-checkout/docs/plugins/api.md#用户关闭权限时)。

0.4.0 支持 schema 12：独立任务、用户批准的系统后台刷新、本地通知、底栏角标和跨实例条件写入。开发会话不安排系统任务。用 `createPluginHarness` 模拟 `task.run`，打包安装后验证系统唤醒与通知点击。参见[完整接口](https://github.com/Lingyan000/fluxdo/blob/codex/ld-store-native-checkout/docs/plugins/api.md#定时任务通知与角标)。

0.3.0 新增 schema 11 清单校验、`forum.read`/`forum.open` 类型和 [用户动态示例](examples/forum-activity/)。元宇宙首页与插件声明的页面都可由用户添加到底栏；开发会话只预览，不改正式导航。宿主需要支持 `navigationEntries` 与 `forumRead`。

示例使用当前账号读取发帖和回复，点击后打开原生话题。论坛请求由可见页面或有效任务的 `ctx.api` 发起，只能使用清单批准的 `profiles`、`activity`、`following` 权限。业务名单、聚合与刷新策略由插件编写。具体协议和限流规则见 [宿主 API 文档](https://github.com/Lingyan000/fluxdo/blob/codex/ld-store-native-checkout/docs/plugins/api.md#论坛只读接口与原生导航)。

实时服务可使用 `ctx.api.streams.open/close`。声明 `eventStreams`，通过 `stream.event` 与 `stream.state` 接收数据和连接状态，隐藏界面会暂停，恢复时重连。协议和完整限制见[宿主 SSE 文档](https://github.com/Lingyan000/fluxdo/blob/codex/ld-store-native-checkout/docs/plugins/api.md#sse-实时事件)。

## 数据迁移、偏好与发行

SDK 0.13.0 提供 host.environment、preferences.get 与 storage.migrate 类型，以及 [数据迁移与偏好示例](examples/data-migration/)。清单声明 dataVersion 和 pluginPreferences，迁移按账号在副本上执行，成功后才切换，不能联网或操作凭证。

测试工具导出 createScenario，可以控制离线、账号、权限和凭证过期；createPluginHarness({virtualTimers:true}) 的 advance 推进虚拟时间。模拟场景只验证业务，不代替真实宿主隔离与系统调度。

pack 与 market-entry 接受 --key private.pem，轮换时另提供 --previous-key old.pem；不传密钥仍生成无签名包。签名绑定规范化清单与资源摘要，宿主用原安装公钥判断连续性，首次信任仍由用户决定。market-entry --channel stable|preview 选择发布渠道，稳定版不能使用预发布版本号。

脚手架的 .github/workflows/plugin-release.yml 经手动触发后校验并创建草稿 Release，带包、摘要和市场条目产物。签名可用仓库 Secrets PLUGIN_SIGNING_KEY 配置，轮换用 PLUGIN_PREVIOUS_SIGNING_KEY；私钥不输出、不进入产物，并从临时目录清理。作者核对草稿后发布。已发布坏版本应在目录标记 withdrawn 或加入 withdrawnVersions，保留原因并发布修复版本，不修改原附件。

页面可声明 `appBar: {title: "PageTitle", actions: "PageActions"}` 并要求 `pageChrome`。插槽引用 RFW 组件，与正文共享数据与事件；返回和关闭由宿主保留。`Button.fullWidth` 提供填满分配区域的操作，`IconButton` 支持 `enabled`、`loading`、`selected`，`Statistics.loading` 显示骨架。

首次取数可声明 `loadingPlaceholders`，使用 `Skeleton`、`SkeletonBox` 和列表/网格的 `loadingPlaceholder`；刷新已有条目时保留内容。完成步骤可声明 `navigationReplacement`，调用 `ctx.api.navigate(page, params, {replace: true})` 或 `prepareNavigation(page, {replace: true})`，返回时跳过已完成页面。替换仅适用于当前插件的普通页面。

恢复服务会话的用户资料可声明 `credentialClaims`，通过 `credentials.status(name, {jwt: true})` 读取 JWT 声明；声明不替代服务端身份验证，也不返回凭证原文。标题栏头像可声明 `iconButtonContent`，用 `IconButton(child: Avatar(...))` 保留按钮提示、触区与键盘交互。

## 无线开发连接

在同一局域网运行 `fluxdo dev --lan 192.168.1.10`，其中地址须为开发机的实际 IPv4 地址。将输出的完整配对地址粘贴到 App 开发中心。Android 无需 adb reverse；iOS 首次使用需要允许本地网络访问。服务仅绑定指定网卡，使用临时 TLS 证书和配对地址中的 SHA-256 指纹，重启服务后须重新配对。开发端口只对可信网络开放。

## npm 分发

所有包具备公开发布配置，`npm.yml` 手动工作流发布经过摘要验证的 GitHub Release 产物。首次发布需要 npm 组织及包名称权限；配置 npm Trusted Publisher 或环境 `npm` 的 `NPM_TOKEN` 后运行。没有完成 npm 发布时继续使用 Release 安装命令。

发布成功后可使用 `npm create fluxdo-plugin@0.13.0 -- my-plugin --distribution npm`，将脚手架依赖指向 npm。默认仍使用 GitHub Release，便于在 npm 尚未配置时使用。npm 发布的版本不可覆盖。

## 本地化和配对诊断

创建时选择 `--template localized`，即可使用 SDK 的 `createTranslator` 配合宿主语言事件更新原生组件。该模板保留 Vite 热替换；服务器返回的用户内容不参与翻译。独立旧脚本可配置 `localization: {baseLocale,script,ui}`，运行 `fluxdo localize` 或 `fluxdo localize --check` 生成、校验 JS/RFW/清单译文；有模块导入的 TypeScript 使用 SDK 翻译函数。

设备连上开发会话后，运行 `fluxdo doctor --pair '<配对地址>'` 查看连接、能力、权限、可见界面尺寸、字段类型、列表数量及 API 调用耗时。不会替换设备连接或读取正文、文件、存储值和凭证。配对地址是临时凭证，请勿写入仓库或公开日志。

SDK 0.13.0 增加临时附件、上传进度与取消、私密图片预览、hCaptcha 原生面板和清单翻译。附件不返回本地路径或文件字节，业务网络仍由宿主按权限执行。具体参数及平台边界见应用的 [API 文档](https://github.com/Lingyan000/fluxdo/blob/codex/ld-store-native-checkout/docs/plugins/api.md)。
