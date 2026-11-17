# FluxDO 插件工具

使用中文交流。这个仓库仅维护 Node 工具、脚手架和 SDK；Flutter、QuickJS 原生实现及账号/支付能力留在应用仓库。

- Node 24.11+，pnpm 版本由 packageManager 固定。使用 pnpm install --frozen-lockfile、pnpm check、pnpm test。
- 三个包一起验证发布，模板随脚手架发布；禁止运行时下载 main 分支模板。
- 生成的项目不得引用本仓库或应用仓库的相对路径。用实际 tgz 在独立临时目录执行创建、安装、检查、构建和打包回归。
- 开发连接和正式插件权限不可混用。测试不得使用真实账号付款或修改服务端数据。
- 注释与提交信息用中文，只暂存本任务改动，禁止 git add -A 或 git add .，已推送历史不改写。
