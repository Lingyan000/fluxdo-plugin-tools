# 发布工具包

CLI、脚手架和 SDK 使用同一发行版本，作为三个独立 npm 格式包放在同一个 GitHub Release。当前未占用或发布 npm registry 名称。

1. 同步三个 package.json 的版本、SDK contract.json 的 sdkVersion，以及模板内 CLI/SDK Release URL。
2. pnpm install 更新锁文件；pnpm test 在仓库外验证真实打包文件。
3. 在应用仓库同步 SDK 兼容夹具，运行契约检查及真实 QuickJS 回归。
4. pnpm pack:release 生成 artifacts 下三个 tgz 与 SHA256SUMS.txt。检查包内容不包含 node_modules、源工作区路径、账号信息和本地构建日志。
5. 在审核过的提交上创建 v<版本> 草稿 Release，上传这四个文件。确认宿主、市场候选与工具链验证后再公开；模板和工具属于同一提交，发布后不覆盖旧版本资产。
6. 用 Release URL 重新执行 npx 创建项目、安装依赖、check/build/test/pack:plugin，验证新用户链路。

CI 在 Windows、macOS 和 Linux 测试 Node 工具链与打包后的 tgz。SDK 的 `contract.hostReference.commit` 记录首次支持该版契约的宿主提交。Windows QuickJS 与 App 联调使用 `.github/workflows/ci.yml` 固定的兼容宿主提交。升级契约时更新两个引用，单独修正宿主回归用例时只更新工作流。npm registry 发布可后续接入，但须先确认包名/作用域和发布权限。


组件或 SDK 更新须先从应用导出，禁止手工改生成参数表。RFW validator 由官方 Dart parser 编译，CLI 无需 Flutter。工具协议变更必须同时通过应用集成 CI。

## 版本与兼容协议

1.0.0 是首次正式发行的起点。工具与脚手架的包版本、SDK sdkVersion、模板依赖一起更新；清单 schema、apiVersion、开发消息协议及数据版本各自描述兼容契约，不随产品发行号重编号。开发阶段公开的 0.x 产物保留原标签和摘要，不当作首版功能的逐版发行记录。

发布顺序为工具包、插件包、市场目录。草稿附件尚不可公开下载，不能提前把在线市场或维护依赖改成草稿地址。发行前的仓外测试使用同批本地 tgz；公开后必须再验证模板中的固定 GitHub URL，之后才能更新依赖它的仓库。
