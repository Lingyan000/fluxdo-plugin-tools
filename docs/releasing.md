# 发布工具包

CLI、脚手架和 SDK 使用同一发行版本，作为三个独立 npm 格式包放在同一个 GitHub Release。当前未占用或发布 npm registry 名称。

1. 同步三个 package.json 的版本、SDK contract.json 的 sdkVersion，以及模板内 CLI/SDK Release URL。
2. pnpm install 更新锁文件；pnpm test 在仓库外验证真实打包文件。
3. 在应用仓库同步 SDK 兼容夹具，运行契约检查及真实 QuickJS 回归。
4. pnpm pack:release 生成 artifacts 下三个 tgz 与 SHA256SUMS.txt。检查包内容不包含 node_modules、源工作区路径、账号信息和本地构建日志。
5. 在审核过的提交上创建 v<版本> Release，上传这四个文件。模板和工具属于同一提交，发布后不覆盖旧版本资产。
6. 用 Release URL 重新执行 npx 创建项目、安装依赖、check/build/pack:plugin，验证新用户链路。

CI 检查 Windows/macOS/Linux 的 Node 工具链和实际 tgz 流程，不代替 Flutter 宿主的原生验证。npm registry 发布可后续接入，但须先确认包名/作用域和发布权限。
