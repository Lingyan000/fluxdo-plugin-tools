# @fluxdo/plugin-cli

FluxDO 插件检查、构建、测试、打包、GitHub 市场草稿与 Vite 开发服务。使用 Node 24.11+，不依赖 Flutter。

命令：fluxdo check、build、test、pack、market-entry、doctor、dev。dev 启动回环服务与 App 配对；--stdio 保留测试协议入口。Android 使用 adb reverse，桌面同机连接。实际预览由 FluxDO 原生组件提供。

清单、SDK 与生产组件契约随包发布，RFW 使用官方解析器编译产物。CLI 静态检查语法和顶层参数名；最终权限和动态值仍由宿主校验。

详见仓库 README 与 docs/development-protocol.md。
