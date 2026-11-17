/// <reference path="./global.d.ts" />
/** 开发期模块生命周期，不会进入正式插件包。 */
interface ImportMeta {
  readonly hot?: {
    readonly data: { [key: string]: unknown };
    accept(): void;
    dispose(callback: (data: { [key: string]: unknown }) => void | Promise<void>): void;
    invalidate(message?: string): void;
  };
}
