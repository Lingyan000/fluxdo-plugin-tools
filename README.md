# FluxDO 插件工具

FluxDO 原生插件的 CLI、项目脚手架和 TypeScript SDK。插件作者只需 Node 24.11+，无需安装 Flutter 或克隆应用源码。

## 创建插件

0.1.0 通过 GitHub Release 分发三个独立 npm 格式包，尚未发布到 npm registry。

~~~sh
npx --yes --package=https://github.com/Lingyan000/fluxdo-plugin-tools/releases/download/v0.1.0/create-fluxdo-plugin-0.1.0.tgz create-fluxdo-plugin my-plugin --id com.example.myplugin
cd my-plugin
npm install
npm run check
npm run build
npm run pack:plugin
~~~

也支持 pnpm。脚手架会把固定版本的 CLI 和 SDK Release 地址写入项目依赖。提交生成的 lockfile 后，可用 npm ci 或 pnpm install --frozen-lockfile 重现安装。

在 FluxDO 插件管理中导入 dist 目录的 .fluxplugin 文件。基础模板包含原生计数卡片、用户确认、存储与提示；默认不申请网络和账号权限。

## 仓库边界

| 包/目录 | 职责 |
| --- | --- |
| packages/cli | 检查、构建、打包；内部包含 Vite 模块服务和开发运行器 |
| packages/create-fluxdo-plugin | 交互/非交互创建项目，模板随包发布 |
| packages/sdk | 公开 API 类型、清单 JSON Schema、版本契约 |
| test | 独立安装、生成项目、包格式和开发连接回归 |
| docs | 工具、协议和发布说明 |

Flutter、QuickJS 原生实现、RFW 渲染、权限和支付留在 [FluxDO 应用](https://github.com/Lingyan000/fluxdo)。GitHub 市场条目和具体服务插件留在 [fluxdo-plugins](https://github.com/Lingyan000/fluxdo-plugins)。

## 可用命令

- fluxdo check：TypeScript、清单、界面声明引用检查。
- fluxdo build：生成单文件 JS、UI 描述和清单到 dist，失败保留旧产物。
- fluxdo pack：重新检查构建，生成 .fluxplugin 并输出 SHA-256。
- fluxdo doctor：检查 Node 环境。
- fluxdo dev --stdio：提供版本 1 的模块开发消息通道，供宿主适配器和集成测试连接。

Vite 负责开发模块依赖和 HMR；tsdown 构建工具自身；正式插件不携带 Vite。完整 RFW 语法和组件参数仍由宿主校验，CLI 不声称替代应用安装校验。

**手机配对、开发实例页面和授权/付款期间的更新协调尚未接入。** dev --stdio 是开发协议入口，当前不能直接连接已发布的手机 App，也没有网页调试面板。详见 [开发协议](docs/development-protocol.md)。

## 维护与验证

~~~sh
pnpm install --frozen-lockfile
pnpm test
pnpm pack:release
~~~

pnpm test 会把三个包制成实际 tgz，在仓库外安装脚手架和依赖，再执行创建、检查、构建、打包及模拟事件。无需 Dart；真实 QuickJS 回归由应用仓库的 tool/plugin_tools 执行。CI 对 Windows、macOS、Linux 运行同样的 Node 测试。

[发布流程](docs/releasing.md)说明三个包的版本联动、模板依赖、发布物校验及宿主兼容测试。
