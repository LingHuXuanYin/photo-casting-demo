// 用 isomorphic-git 强制推送到远端 main
// 用法：node scripts/git-push.js <GITHUB_TOKEN>
const path = require('node:path');
const fs = require('node:fs');

const git = require('isomorphic-git');
const http = require('isomorphic-git');

const ROOT = path.resolve(__dirname, '..');
const REMOTE_URL = 'https://github.com/LingHuXuanYin/photo-casting-demo';

const NODE_FS = require('node:fs');
const fsAdapter = {
  readFile: (p, opts) => NODE_FS.promises.readFile(p, opts),
  writeFile: (p, data, opts) => NODE_FS.promises.writeFile(p, data, opts),
  unlink: (p) => NODE_FS.promises.unlink(p),
  readdir: (p) => NODE_FS.promises.readdir(p),
  mkdir: (p, opts) => NODE_FS.promises.mkdir(p, opts),
  rmdir: (p) => NODE_FS.promises.rmdir(p),
  stat: (p) => NODE_FS.promises.stat(p),
  lstat: (p) => NODE_FS.promises.lstat(p),
  readlink: (p) => NODE_FS.promises.readlink(p),
  symlink: (target, p) => NODE_FS.promises.symlink(target, p),
  chmod: (p, mode) => NODE_FS.promises.chmod(p, mode),
};

const TOKEN = process.argv[2];
if (!TOKEN) {
  console.error('错误：需要 GitHub Personal Access Token');
  console.error('用法：node scripts/git-push.js <TOKEN>');
  console.error('');
  console.error('如何生成 token：');
  console.error('  1. 打开 https://github.com/settings/tokens');
  console.error('  2. 点 [Generate new token] → [Generate new token (classic)]');
  console.error('  3. Note 填 "photo-design-push"');
  console.error('  4. Expiration 选 7 天（用完即焚）');
  console.error('  5. Select scopes: 勾上 [repo]');
  console.error('  6. 点 [Generate token]');
  console.error('  7. 复制 token（ghp_开头的一串）');
  console.error('  8. 粘给我:  node scripts/git-push.js ghp_xxxxxxxx');
  process.exit(1);
}

(async () => {
  console.log('=== 推送本地 master → 远端 main（force）===');
  console.log('远端:', REMOTE_URL);
  console.log('');

  // 1. 加 remote
  await git.addRemote({
    fs: fsAdapter,
    dir: ROOT,
    remote: 'origin',
    url: REMOTE_URL,
    force: true, // 覆盖已存在的 remote 配置
  });
  console.log('✓ 已加 remote: origin');

  // 2. push（force）
  console.log('开始推送（可能需要几秒到几分钟，取决于网速）...');
  console.log('');

  let lastReport = 0;
  await git.push({
    fs: fsAdapter,
    http,
    dir: ROOT,
    remote: 'origin',
    ref: 'master',        // 本地分支
    remoteRef: 'main',    // 远端分支（覆盖）
    force: true,          // 强制覆盖
    onAuth: () => ({
      username: TOKEN,
      password: TOKEN,
    }),
    onMessage: (msg) => {
      // 显示推送进度
      const m = msg.replace(/\0/g, '').trim();
      if (m) console.log('  [server]', m);
    },
    onProgress: (event) => {
      const now = Date.now();
      if (now - lastReport > 500) {
        const phase = event.phase;
        const loaded = event.loaded || 0;
        const total = event.total || 0;
        if (total > 0) {
          const pct = ((loaded / total) * 100).toFixed(1);
          process.stdout.write(`\r  [${phase}] ${(loaded/1024).toFixed(0)}KB / ${(total/1024).toFixed(0)}KB (${pct}%)`);
        } else if (loaded > 0) {
          process.stdout.write(`\r  [${phase}] ${(loaded/1024).toFixed(0)}KB`);
        }
        lastReport = now;
      }
    },
  });
  console.log('\n');

  // 3. 验证
  console.log('=== 验证推送结果 ===');
  const log = await git.log({ fs: fsAdapter, dir: ROOT, depth: 1 });
  const c = log[0];
  console.log(`本地 HEAD: ${c.oid}`);
  console.log(`本地分支: master`);

  // 4. fetch 验证远端
  console.log('');
  console.log('正在 fetch 远端验证...');
  try {
    const remote = await git.listRemotes({ fs: fsAdapter, dir: ROOT });
    console.log('  remotes:', JSON.stringify(remote));
  } catch (e) {
    console.log('  (验证失败但不影响推送)');
  }

  console.log('');
  console.log('✓ 推送完成！');
  console.log('  仓库地址: ' + REMOTE_URL);
  console.log('  远端分支: main (已覆盖)');
  console.log('  本地分支: master');
  console.log('');
  console.log('  浏览器打开查看: ' + REMOTE_URL);
})().catch((err) => {
  console.error('');
  console.error('✗ 推送失败:', err.message || err);
  console.error('');
  console.error('可能的原因：');
  console.error('  1. Token 无效 / 过期 / scope 不够（需要 repo）');
  console.error('  2. Token 没有这个仓库的写权限（确认是仓库 owner）');
  console.error('  3. 网络问题');
  process.exit(1);
});
