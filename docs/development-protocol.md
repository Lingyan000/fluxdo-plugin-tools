# 开发协议 1

插件宿主 API 与开发连接分开。开发连接不会增加插件的账号、网络或支付权限。

## 设备连接

fluxdo dev 默认只监听 127.0.0.1:5174。每次启动生成 192 位随机配对令牌；App 解析 fluxdo-dev 地址后，通过 WebSocket /fluxdo 的 Authorization 请求头发送令牌，不写入 URL 或磁盘。拒绝 Origin 请求，不能从网页连接。仅允许一个活动设备，新连接撤销旧连接。Android 使用 adb reverse；桌面直接连接，iOS 真机尚无配对方式。

| 消息 | 方向 | 用途 |
| --- | --- | --- |
| project | CLI → App | protocolVersion、session、revision、manifest、ui、runner、entry；启动前审阅 |
| ui | CLI → App | session、递增 revision、完整 RFW；验证成功后原子替换 |
| vite | 双向 | 固定 Vite 版本 HotPayload；fetchModule/getBuiltins 回复只送原连接 |
| sync | App → CLI | 请求最新项目快照，需用户重新启动 |
| log | App → CLI | 当前 runtimeId/pluginId 的脱敏日志；有频率上限 |
| status / diagnostic | 双向 / CLI → App | 更新状态和错误；不包含配对令牌 |

连接断开后最多按 1/2/4/8/16 秒重试。恢复后重新取快照并等待用户确认，不重放上一轮消息。待应用更新最多 32 条，超限改为重新审阅。应用消息最大 2 MiB，CLI 接收最大 1 MiB，并限制发送积压和消息频率。

## 更新与状态

JS 由 Vite ModuleRunner 在现有 QuickJS 限额中执行，拒绝外部模块。项目根目录边界、禁止 Node/远程导入与不读取 .env/vite.config 的限制不变。RFW 使用与正式安装相同的解析及组件契约。

接受更新使用 import.meta.hot.accept()，显式持久状态放 hot.data。模块成功执行后提交新事件，清理旧事件和模块定时器；移除模块也释放资源。旧异步回调经作用域保护，无法继续写数据或调用 API。通过 globalThis 绕过模块包装的代码不享受此便利隔离，但仍受宿主权限与运行限额约束。

宿主等待异步事件和宿主调用完成才开始自动替换；前后台切换、授权、付款期间保持旧代码。full-reload 只提出重启请求。用户手动重启可以取消普通挂起事件，进行中的原生 UI 操作则必须先结束。

正式插件与开发实例使用不同文件目录、安装索引和凭证存储。开发凭证只在内存，同一会话同权限重启可保留，退出开发页/换账号/改变权限时销毁。正常业务 API 仍可能产生真实副作用，应使用测试环境或 SDK 模拟宿主；框架不自动撤销业务行为。

## 标准流兼容

fluxdo dev --stdio 保留原适配器入口。stdout 是逐行 JSON，首次返回 fluxdo:ready，其后为 HotPayload；stderr 诊断。不包含设备 project/ui 协议，用于模块级测试。

## 错误定位

App 通过命名 QuickJS evaluate 执行模块，CLI 保留 fetchModule 内嵌 source map，最多 256 份，将文件、行、列转换为原始 TS 位置。没有映射的位置保留生成位置。

## 验证

Node CI 验证真实 tgz、协议隔离、RFW 与模板测试。应用 CI 另运行 SDK/组件契约、真实 QuickJS 热替换和真实 WebSocket → App 会话 → QuickJS 集成回归。全部使用临时数据，不执行真实支付。
