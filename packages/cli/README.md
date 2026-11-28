# @fluxdo/plugin-cli

FluxDO 插件检查、构建、测试、打包、GitHub 市场草稿与 Vite 开发服务。使用 Node 24.11+，不依赖 Flutter。

命令：fluxdo check、build、test、pack、market-entry、doctor、dev。dev 启动回环服务与 App 配对；--stdio 保留测试协议入口。Android 使用 adb reverse，桌面同机连接。实际预览由 FluxDO 原生组件提供。

清单、SDK 与生产组件契约随包发布，RFW 使用官方解析器编译产物。CLI 静态检查语法和顶层参数名；最终权限和动态值仍由宿主校验。

详见仓库 README 与 docs/development-protocol.md。

### 无线扫码配对

`fluxdo dev --lan 本机IPv4` 将临时配对地址与终端二维码写入 stderr，stdout 保留设备 JSON 日志。Android、iOS 与 macOS 可在 App 开发中心选择“扫码配对”，确认地址后连接并审阅插件权限；Windows/Linux 使用粘贴。二维码包含临时令牌和证书指纹，不应截图公开或写入仓库。`--stdio` 保持纯开发协议输出，不能同时使用 `--lan`。

`fluxdo market-entry` 从实际签名包生成权限与发布者预览，预览不替代安装时的验签与权限审阅。
