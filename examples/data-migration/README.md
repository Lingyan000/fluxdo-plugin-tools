# 数据迁移与偏好

在工具仓库根目录执行 node packages/cli/dist/bin.mjs check examples/data-migration 或 build examples/data-migration。

此例把 dataVersion 1 的 oldItems 转移到版本 2 的 items。storage.migrate 只读取并更改副本；没有数据的新安装不触发迁移。紧凑显示在宿主管理页设置，插件只读 preferences.get。页面根据 host.environment 的语言标签选择文案。

测试可用 createPluginHarness 初始化 {oldItems:[1,2]}，派发 storage.migrate 并检查 items 与旧键清除。运行时故障、迁移失败和设备级账号隔离仍应在 App 验证。
