#!/usr/bin/env node
/**
 * 跨平台 env 加载器
 *
 * 用法：
 *   node scripts/load-env.js <env-file> -- <command> [args...]
 *   node scripts/load-env.js <env-file> <command> [args...]   (兼容省略 --)
 *
 * 例：
 *   node scripts/load-env.js env_config/.env_dev -- tsx watch src/index.ts
 *   node scripts/load-env.js env_config/.env_dev -- vite
 *   node scripts/load-env.js env_config/.env_fnOS -- node server/dist/index.js
 *
 * 作用：
 *   1. 读 env_config/<file> 里的 KEY=VALUE 行
 *   2. 塞到 process.env（覆盖已有值）
 *   3. spawn 子进程跑 <command>，子进程继承 env
 *   4. 父进程等子进程退出，传递 exit code
 *
 * 跨平台：纯 Node.js，无新依赖。
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const envFile = process.argv[2];
if (!envFile) {
  console.error('[load-env] 用法: node scripts/load-env.js <env-file> -- <command> [args...]');
  process.exit(1);
}

// 用 process.cwd()（npm workspace script 跑时 cwd 是 web/ 或 server/）
// envFile 由 dev script 传过来，相对 cwd 写
// 例：'../env_config/.env_dev' 从 web/ 出发 = monorepo/env_config/.env_dev ✓
const filePath = path.resolve(process.cwd(), envFile);
if (!fs.existsSync(filePath)) {
  console.error('[load-env] env 文件不存在:', filePath);
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
let loaded = 0;
for (const line of content.split(/\r?\n/)) {
  // 跳过空行和注释（# 开头）
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  // 匹配 KEY=VALUE
  const m = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (m) {
    process.env[m[1]] = m[2];
    loaded++;
  }
}
console.log(`[load-env] 加载 ${loaded} 个变量 from ${envFile}`);

// 找 `--` 分隔符或直接取 env-file 之后的所有参数
const dashDash = process.argv.indexOf('--');
const cmdArgs = dashDash >= 0 ? process.argv.slice(dashDash + 1) : process.argv.slice(3);
if (cmdArgs.length === 0) {
  console.error('[load-env] 缺少要执行的命令');
  process.exit(1);
}

const [cmd, ...args] = cmdArgs;

// Windows 上 spawn('vite') 找不到 .bin/vite.cmd（CreateProcess 不加 .cmd 后缀）
// loader 主动找 .bin 下的全路径
function findBin(name) {
  if (path.isAbsolute(name) || name.includes('/') || name.includes('\\')) {
    return name; // 已经是路径
  }
  const isWin = process.platform === 'win32';
  const exts = isWin ? ['.cmd', '.ps1', '.exe', ''] : [''];
  const dirs = [
    path.resolve(process.cwd(), 'node_modules/.bin'),
    path.resolve(process.cwd(), '../node_modules/.bin'),
  ];
  for (const dir of dirs) {
    for (const ext of exts) {
      const full = path.join(dir, name + ext);
      if (fs.existsSync(full)) return full;
    }
  }
  return name; // 找不到时 fallback，让系统 PATH 自己解析
}
const resolvedCmd = findBin(cmd);

const child = spawn(resolvedCmd, args, {
  stdio: 'inherit',
  env: process.env,
  // Windows 上 spawn .cmd 文件必须开 shell（EINVAL 错误）
  // 反正我们 spawn 的是绝对路径（findBin 解析过的 .cmd），shell 不会重新解析
  shell: process.platform === 'win32',
});

child.on('exit', (code) => process.exit(code ?? 0));
child.on('error', (err) => {
  console.error('[load-env] 启动子进程失败:', err.message);
  process.exit(1);
});
