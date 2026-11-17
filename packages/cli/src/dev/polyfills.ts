// 仅进入开发运行器，正式插件包不包含这些兼容实现。
import 'fast-text-encoding';
import URLImplementation from 'core-js-pure/actual/url/index.js';
import atobImplementation from 'core-js-pure/actual/atob.js';

globalThis.URL ??= URLImplementation;
globalThis.atob ??= atobImplementation;
