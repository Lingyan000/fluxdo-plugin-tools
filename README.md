# FluxDO 插件工具

用 TypeScript / JavaScript 编写逻辑，以 RFW 驱动 Flutter 原生界面。CLI、脚手架和 SDK 同仓维护；插件作者只需 Node 24.11+，不需要 Flutter 或应用源码。账号、付款、原生运行时与权限检查由 [FluxDO 宿主](https://github.com/Lingyan000/fluxdo)提供，业务插件和市场条目在 [fluxdo-plugins](https://github.com/Lingyan000/fluxdo-plugins)。

## 创建插件

首发候选为 **1.0.0，目前仍是草稿**。以下固定 URL 在 v1.0.0 公开后才可使用；发行前用同批本地 tgz 验证。三个 npm 格式包通过同一个 GitHub Release 分发，npm registry 尚未发布。

```sh
npx --yes --package=https://github.com/Lingyan000/fluxdo-plugin-tools/releases/download/v1.0.0/create-fluxdo-plugin-1.0.0.tgz create-fluxdo-plugin my-plugin --id com.example.myplugin --template basic
cd my-plugin
npm install
npm run check
npm test
npm run dev
```

`basic` 包含计数卡片、确认、存储和提示；`localized` 在此基础上加入四语与 SDK 翻译函数。默认不申请网络或账号权限。生成项目将同版 CLI/SDK 的固定 Release URL 写入依赖，提交锁文件后用 `npm ci` 或 `pnpm install --frozen-lockfile` 复现安装，不会在运行时拉取 main 分支模板。

新作者先阅读[开发指南](https://github.com/Lingyan000/fluxdo/blob/dev/docs/plugins/README.md)，查看最小可运行页面与版本字段说明。

## 常用命令

在项目目录用 `npx --no-install fluxdo <命令>`，或使用脚手架提供的 npm scripts。也支持 pnpm。

| 命令 | 用途 |
| --- | --- |
| `check` | TypeScript、清单、完整 RFW 语法、静态组件参数与嵌套字段检查 |
| `build` | 输出单文件 JS、UI 和清单到 dist；失败保留旧产物 |
| `test` | 构建后运行 test/*.test.mjs，外部 API 需显式 mock |
| `dev` | 回环原生预览与 HMR；`--lan IPv4` 无线配对 |
| `pack --key ../private.pem` | 重新检查构建并生成签名 .fluxplugin，输出 SHA-256；省略密钥生成无签名包 |
| `market-entry --repository URL --tag TAG --key ../private.pem` | 同一次构建生成包和市场条目，支持 `--channel stable\|preview` |
| `doctor` / `doctor --pair '地址'` | 检查 Node，或诊断已连接宿主；传项目目录时另检查项目 |
| `localize` / `localize --check` | 生成或检查独立旧脚本的 JS/RFW/清单译文 |

生成本地安装包用 `npm run pack:plugin`，在应用导入 `dist/*.fluxplugin`。发布时优先使用脚手架的手动 `plugin-release.yml`，或按[发布与排错](https://github.com/Lingyan000/fluxdo/blob/dev/docs/plugins/publishing-and-troubleshooting.md)操作。`market-entry` 会重新构包，上传包与条目必须来自同一次生成。权限和作者指纹预览从实际包推导，安装时仍会验签和审阅权限。

CLI 内置从官方 Dart RFW parser 编译的校验器，插件作者无需 Dart；动态引用与真实布局仍需应用预览。Vite 管理开发模块依赖与 HMR，tsdown 构建工具自身，正式插件不携带 Vite 或开发服务。

## App 原生预览与热更新

运行 `npm run dev`，在「元宇宙 → 插件管理 → 更多 → 开发中心 → 教程 → 连接开发工具」粘贴地址，也可用右上角快捷入口。审阅后启动临时实例，正式插件的代码、数据和凭据保持隔离。

### 同机与 USB

默认监听 `127.0.0.1:5174`，桌面在同一电脑直接连接。Android USB 先运行 `adb reverse tcp:5174 tcp:5174`。用 `--port` 改端口时转发端口要对应。iOS 真机使用下方无线连接。

### 无线开发与扫码配对

```sh
npm run dev -- --lan 192.168.1.10
```

替换为开发机实际 IPv4。CLI 仅绑定指定网卡，终端二维码和配对地址写 stderr，stdout 保留设备 JSON 日志。Android/iOS/macOS 可扫码，Windows/Linux 或相机不可用时粘贴。扫码只填写地址，仍须主动连接和审阅权限。

配对使用临时 TLS 证书，应用按地址中的 SHA-256 指纹校验后发送临时令牌。仅在可信局域网开放端口；iOS 首次连接需允许本地网络，网络隔离或防火墙可能阻止连接。重启服务必须重新扫码。地址含临时凭据，不公开截图、不写入仓库或日志。

连接后运行：

```sh
npx --no-install fluxdo doctor --pair '完整配对地址'
```

诊断只返回能力、权限、可见界面尺寸、字段类型、列表数量与调用耗时；不读取正文、文件、存储值或凭证，不抢占现有设备连接。`dev --stdio` 留给宿主适配与测试，输出纯版本 1 开发协议，不能与 `--lan` 同用。

### 更新与状态

- TS 保存后替换接受 HMR 的模块；RFW 保存后更新原生组件库并保留界面数据。
- 新模块成功执行后才撤销旧事件和定时器。语法或界面错误保留上一版本；自建资源用 `import.meta.hot.dispose` 清理，需要保留的模块数据用 `hot.data`。
- 顶层外部副作用无法回滚。异步事件、宿主调用、Connect 或付款未完成时暂缓更新，不重放外部写操作。
- 完整模块图重载、断线恢复和清单变化需要重新审阅启动，不保证任意模块状态无损恢复。
- 关闭会话销毁临时数据和内存凭据。日志只回传当前实例并脱敏，QuickJS 堆栈映射到 TS 位置。

协议见 [开发协议](docs/development-protocol.md)，宿主行为见[开发工具与热更新](https://github.com/Lingyan000/fluxdo/blob/dev/docs/plugins/development-tooling.md)。开发连接不会赋予普通插件 Node、DOM 或自由联网能力。系统后台、通知与底栏入口须通过安装包验证；真实摄像头与账号由接入方验收。

## 核心能力速览

| 场景 | 能力与参考 |
| --- | --- |
| 按需权限 | `permissions.status/request`，用户点击时申请缺少的范围；[用户关闭权限时](https://github.com/Lingyan000/fluxdo/blob/dev/docs/plugins/api.md#用户关闭权限时) |
| 论坛与底栏 | `forum.read/open`、`pages[].navigation`，声明候选后由用户添加；[接口与限流](https://github.com/Lingyan000/fluxdo/blob/dev/docs/plugins/api.md#论坛只读接口与原生导航)、[动态示例](examples/forum-activity/) |
| 原生 UI | 自适应集合、时间线、输入、页面标题栏、头像按钮、骨架、替换导航与弹层关闭；[组件](https://github.com/Lingyan000/fluxdo/blob/dev/docs/plugins/components.md)、[标题栏](https://github.com/Lingyan000/fluxdo/blob/dev/docs/plugins/components.md#页面标题栏) |
| 后台与通知 | 独立任务、条件写、通知状态和角标；开发会话不安排系统任务；[调度边界](https://github.com/Lingyan000/fluxdo/blob/dev/docs/plugins/api.md#定时任务通知与角标) |
| 实时消息 | `streams.open/close`，可见界面接收事件，隐藏暂停；[SSE](https://github.com/Lingyan000/fluxdo/blob/dev/docs/plugins/api.md#sse-实时事件) |
| 存储与迁移 | `storageScopes` 显式 shared/account；账号区需要 identity。`dataMigrations` / `accountDataMigration` 在隔离副本迁移，不联网或读其他账号；[存储作用域](https://github.com/Lingyan000/fluxdo/blob/dev/docs/plugins/api.md#普通存储作用域)、[迁移](https://github.com/Lingyan000/fluxdo/blob/dev/docs/plugins/automatic-updates.md#版本恢复与数据迁移) |
| 偏好与语言 | `host.environment`、`preferences.get`、清单翻译与语言/偏好变化事件；[示例](examples/data-migration/)、[API](https://github.com/Lingyan000/fluxdo/blob/dev/docs/plugins/api.md#宿主环境偏好与迁移) |
| 查询与分页 | `@fluxdo/plugin-sdk/data` 有界缓存、请求合并、tags 失效、分页去重和迟到丢弃；不自动重放写操作；[SDK 示例](packages/sdk/README.md#查询缓存和分页) |
| 附件与验证 | 临时句柄、受控上传、私密图片与 hCaptcha；不给脚本本地路径或文件字节；[API](https://github.com/Lingyan000/fluxdo/blob/dev/docs/plugins/api.md#临时附件与私密图片) |

TypeScript 本地化使用 `createTranslator` 与 `host.environmentChanged`，服务端用户内容不翻译。独立旧 JS 可配置 `localization: {baseLocale,script,ui}` 交给 `localize`；`runtimeHelpers: ['data']` 将同版数据工具内联为 `fluxdoData`，正式运行不下载代码。

模板使用 schema 12 / API 2。按实际使用声明 `requiredFeatures`，例如 `pageChrome`、`loadingPlaceholders`、`navigationReplacement`、`iconButtonContent`；超过 16 页需要 `extendedPages`，最多 32 页。`credentialClaims` 允许读取 JWT 声明，但声明不是服务端身份验证。完整类型与契约见 [SDK](packages/sdk/README.md)。

`createScenario` 可控制离线、权限、账号和凭证过期；`createPluginHarness({virtualTimers:true})` 用 `advance` 推进时间，`dispatch` 注入事件。显式 mock 验证业务，不能代替真实宿主的安全检查与系统调度。

## 仓库维护与发布

`packages/cli` 维护命令和开发服务，`packages/create-fluxdo-plugin` 维护随包模板，`packages/sdk` 维护公开类型和可选数据工具。`test` 覆盖独立安装与跨包联调。

维护者从[发布工具包](docs/releasing.md)进入：三包版本联动、仓外 tgz 验证、固定宿主契约、GitHub 草稿及 npm 发布。应用内部实现与真实 QuickJS 回归留在宿主仓，业务插件留在市场仓。
