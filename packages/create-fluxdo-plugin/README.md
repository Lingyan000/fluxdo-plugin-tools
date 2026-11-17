# create-fluxdo-plugin

FluxDO 原生插件脚手架，与 CLI/SDK 在同仓库维护和测试，独立发布 npm 格式包。

create-fluxdo-plugin my-plugin --id com.example.demo --name 示例 --author 作者 --yes

不带 --yes 时在交互终端询问项目目录和模板；不覆盖已存在目录，不自动安装依赖或执行模板脚本。模板随版本发布，不下载远端 main 分支。模板依赖指向同次 Release 的 CLI 和 SDK 固定版本。

当前提供 basic 原生计数卡片模板，包含 TypeScript、RFW UI、清单和 check/build/pack:plugin 命令。手机开发连接尚未交付，dev 命令当前仅用于标准流协议适配。
