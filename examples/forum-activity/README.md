# 论坛动态页面示例

在工具仓根目录执行 `pnpm build`，然后 `node packages/cli/dist/bin.mjs dev examples/forum-activity`。
Android 先执行 `adb reverse tcp:5174 tcp:5174`，再按 CLI 提示在 App 开发中心配对。正式安装后，在外观设置的底栏布局中添加「动态」。开发会话只预览，不改正式底栏。

这里只展示类型化的论坛读取、原生话题跳转和页面贡献。关注名单、聚合、轮询及缓存属于插件业务。清单需 schema 11；旧应用会拒绝安装。

真实数据由登录账号权限决定。不要在模块顶层读取论坛；使用 `ctx.api`。页面隐藏时宿主冻结定时器，论坛调用返回 `forum_not_visible`。切回收到 `page.resume`，不会再次触发 `page.open`。响应数据不要转发给未告知用户的外部服务。
