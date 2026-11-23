import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('产物包含本地化资源和语言事件',()=>{const script=readFileSync(new URL('../dist/main.js',import.meta.url),'utf8');assert.ok(script.includes('host.environmentChanged'));assert.ok(script.includes('Count:'));});
