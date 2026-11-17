# FluxDO 原生插件

使用 Node 24.11+，无需安装 Flutter 或克隆应用。

~~~sh
pnpm install
pnpm check
pnpm test
pnpm dev
# 准备发布
pnpm pack:plugin
~~~

在 App「插件管理 → 开发中心 → 连接开发工具」粘贴配对地址，审阅权限并预览。Android 先通过 USB 运行 adb reverse tcp:5174 tcp:5174，桌面同机直接连接。需要支持开发会话的 FluxDO 版本。

- plugin.json：身份、页面、权限与能力。
- src/main.ts：事件与业务，不使用 Node/DOM API。
- ui.rfwtxt：原生界面；CLI 校验语法和顶层组件参数名。
- test/plugin.test.mjs：使用 SDK 模拟确认、存储、网络等宿主能力；不会访问真实账号。
- fluxdo.config.json：源码入口。

保存 TS/RFW 自动更新，正在进行的操作结束后生效。需要完整重启时在 App 确认。开发实例与正式插件隔离，退出会清空临时数据。

发布包在 dist/*.fluxplugin；fluxdo market-entry --repository https://github.com/OWNER/REPO --tag VERSION 可生成市场条目草稿，补充说明与截图后提交目录仓库。工具与 SDK 固定使用同一版本 GitHub Release，提交 lockfile 以便复现。
