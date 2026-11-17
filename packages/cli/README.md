# @fluxdo/plugin-cli

FluxDO 插件检查、构建、打包和 Vite 开发模块服务。使用 Node 24.11+。

命令：fluxdo check、fluxdo build、fluxdo pack、fluxdo doctor、fluxdo dev --stdio。CLI 不依赖 Flutter；正式产物为单文件 JS、RFW 文本和清单组成的 .fluxplugin。

清单 JSON Schema 和契约在构建时从同仓库 SDK 复制进 dist，避免 Release tarball 安装时需要未发布的内部包。具体资源和权限以宿主校验为准。

开发模块服务仅通过调用方提供的连接工作；标准流模式不监听网络端口。手机配对和应用界面尚未实现。使用方式见仓库 README。
