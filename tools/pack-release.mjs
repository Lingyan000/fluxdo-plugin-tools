import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'artifacts');
await mkdir(out, { recursive: true });
const packageManager = process.env.npm_execpath;
if (!packageManager || !packageManager.replaceAll('\\', '/').includes('pnpm')) {
  throw new Error('请通过 pnpm pack:release 或 pnpm test 调用发布打包');
}
// pnpm 既可作为 Node 脚本安装，也可使用独立的原生可执行文件。
const isScript = /\.(?:c|m)?js$/i.test(packageManager);
const command = isScript ? process.execPath : packageManager;
const args = [...(isScript ? [packageManager] : []), 'pack', '--pack-destination', out];
const files = [];
for (const entry of await readdir(resolve(root, 'packages'), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const directory = resolve(root, 'packages', entry.name);
  const meta = JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8'));
  if (meta.private) continue;
  const result = spawnSync(command, args, { cwd: directory, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || String(result.error));
  console.log(result.stdout.trim());
  files.push(meta.name.replace(/^@/, '').replaceAll('/', '-') + '-' + meta.version + '.tgz');
}
const hashes = [];
for (const file of files.sort()) {
  hashes.push(createHash('sha256').update(await readFile(resolve(out, file))).digest('hex') + '  ' + file);
}
await writeFile(resolve(out, 'SHA256SUMS.txt'), hashes.join('\n') + '\n');
