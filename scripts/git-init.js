// 用 isomorphic-git（纯 JS 实现的 git）在本地初始化仓库并 commit
// 不需要系统装 git 命令行
const path = require('node:path');
const fs = require('node:fs');

const git = require('isomorphic-git');
const { fs: fsa } = require('isomorphic-git');

const ROOT = path.resolve(__dirname, '..');
const NODE_FS = require('node:fs');

// Node.js fs 适配器
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

(async () => {
  console.log(`初始化 git 仓库: ${ROOT}`);

  // 1. init
  await git.init({ fs: fsAdapter, dir: ROOT, defaultBranch: 'master' });
  console.log('✓ git init 完成 (默认分支: master)');

  // 2. set user config
  await git.setConfig({
    fs: fsAdapter,
    dir: ROOT,
    path: 'user.name',
    value: 'Mavis',
  });
  await git.setConfig({
    fs: fsAdapter,
    dir: ROOT,
    path: 'user.email',
    value: 'mavis@MiniMax.local',
  });
  console.log('✓ git config user.name/email 完成');

  // 3. add 所有文件
  console.log('添加文件到暂存区...');
  const status = await git.statusMatrix({ fs: fsAdapter, dir: ROOT });
  // status[i] = [filepath, HEAD, WORKDIR, STAGE]
  // [filepath, 0, 2, 0] = 新增未跟踪
  // [filepath, 0, 2, 2] = 新增已 stage
  // [filepath, 1, 2, 1] = 修改未 stage
  let added = 0;
  for (const [filepath, , workdir, stage] of status) {
    if (workdir !== stage) {
      if (workdir === 0) {
        // 已删除
        await git.remove({ fs: fsAdapter, dir: ROOT, filepath });
      } else {
        // 新增或修改
        await git.add({ fs: fsAdapter, dir: ROOT, filepath });
        added++;
      }
    }
  }
  console.log(`✓ git add 完成（${added} 个文件）`);

  // 4. commit
  const commitMessage = [
    'Initial commit: 模特卡片生成器 v1',
    '',
    'v0.1-v0.4 完成：',
    '- 前后端骨架（Fastify + Vite + React + TypeScript）',
    '- 画布编辑器（Konva.js + 拖拽/缩放/旋转/多选/撤销重做/对齐辅助线）',
    '- 数据层（IndexedDB 持久化 + 2s 防抖自动保存 + Ctrl+S）',
    '- 5 个内置模板（经典竖版/现代横版/极简方形/大片风格/黑白大片）',
    '- 后端渲染（@napi-rs/canvas + pdf-lib，JPG/PDF 1x/2x）',
    '- 字体打包到 server/fonts/（思源黑体 + Inter，OFL 免费可商用）',
    '- 项目列表 Dashboard（搜索/缩略图/删除）',
    '- 集成测试（后端 23 用例 + 前端 46 用例）',
    '- 用户手册（docs/用户手册.md）',
  ].join('\n');

  const sha = await git.commit({
    fs: fsAdapter,
    dir: ROOT,
    message: commitMessage,
    author: {
      name: 'Mavis',
      email: 'mavis@MiniMax.local',
    },
  });
  console.log(`✓ git commit 完成 (${sha.slice(0, 7)})`);

  // 5. 确认 master 分支
  const branches = await git.listBranches({ fs: fsAdapter, dir: ROOT });
  const currentBranch = await git.currentBranch({ fs: fsAdapter, dir: ROOT });
  console.log(`✓ 分支: ${branches.join(', ')} (当前: ${currentBranch})`);

  // 6. log
  const log = await git.log({ fs: fsAdapter, dir: ROOT, depth: 1 });
  console.log('\n--- 最近 1 个 commit ---');
  for (const c of log) {
    console.log(`  ${c.oid.slice(0, 7)} ${c.commit.message.split('\n')[0]}`);
    console.log(`  Author: ${c.commit.author.name} <${c.commit.author.email}>`);
    console.log(`  Date: ${c.commit.author.timestamp}`);
  }

  // 7. 状态总览
  const finalStatus = await git.statusMatrix({ fs: fsAdapter, dir: ROOT });
  const counts = { tracked: 0, modified: 0, new: 0, deleted: 0 };
  for (const [filepath, head, workdir, stage] of finalStatus) {
    if (head === 0 && workdir === 2 && stage === 0) counts.new++;
    else if (head === 1 && workdir === 2 && stage === 1) counts.tracked++;
    else if (head === 1 && workdir === 2 && stage === 1) counts.modified++;
    else if (head === 1 && workdir === 0 && stage === 0) counts.deleted++;
  }
  console.log('\n--- 仓库状态 ---');
  console.log(`  .git 目录: ${fs.existsSync(path.join(ROOT, '.git'))}`);
  console.log(`  master 分支 commit: 1`);
  console.log(`  新增文件（已 commit）: ${counts.new}`);
  console.log(`  跟踪文件（已 commit）: ${counts.tracked}`);

  // 8. 大小
  function dirSize(dir) {
    let total = 0;
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) total += dirSize(p);
      else total += fs.statSync(p).size;
    }
    return total;
  }
  const gitSize = dirSize(path.join(ROOT, '.git'));
  console.log(`  .git 目录大小: ${(gitSize / 1024 / 1024).toFixed(2)} MB`);
})().catch((err) => {
  console.error('失败：', err);
  process.exit(1);
});
