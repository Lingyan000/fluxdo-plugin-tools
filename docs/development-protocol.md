# 开发模块协议 1

这是 CLI 与宿主开发适配器之间的模块协议，不是插件访问宿主 API 的权限协议。

## 标准流连接

运行 fluxdo dev <目录> --stdio。stdout 每行一个 JSON，stderr 是诊断信息。启动返回 type=fluxdo:ready、protocolVersion=1、entry 和 pluginId。输入输出随后使用固定 Vite 8.3.8 的 HotPayload；Vite 协议版本受本工具版本约束。

CLI 包导出 createPluginDevServer，调用 connect(send) 建立客户端，receive(payload) 输入消息，close() 释放客户端。模块响应只发送给原请求连接。运行器在 dist/dev/runner.js，暴露 FluxdoDev.createPluginModuleRunner。宿主可经现有 QuickJS JSON 桥转发 transport.send/connect。

Vite 模块加载受项目文件范围约束；Node 内置导入和远程代码导入被拒绝。开发运行器仍处在原 QuickJS 执行限额内，不能因此获得 Node、文件系统、DOM 或自由联网能力。服务不会自动加载项目 vite.config 或环境文件。

## 热替换范围

- 可接受更新的模块通过 import.meta.hot.accept 参与 HMR；hot.dispose 负责释放模块资源，hot.data 保存显式数据。
- 未变化模块保留实例；变化模块内部状态不会自动无损保留。
- 语法错误时旧处理器继续运行；修复后可继续更新。
- full-reload 交给 onReloadRequired。模块运行器不会直接重新执行入口，避免重放业务操作。
- RFW 更新、开发实例数据隔离、手机配对、日志源映射和支付/Connect 协调仍属于宿主开发会话实现，未包含在当前 CLI 中。

## 宿主兼容测试

应用仓库提供 tool/plugin_tools/check_sdk_contract.mjs 和 native.test.mjs。设置 FLUXDO_PLUGIN_TOOLS 指向本仓库，FLUXDO_DART 指向应用 SDK 后执行。这些测试使用应用真实 QuickJS；工具仓库普通测试不依赖 Flutter。
