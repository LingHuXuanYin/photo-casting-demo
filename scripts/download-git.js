// 下载 Git for Windows portable
// 用 7z 自解压格式（不需要管理员权限）
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const URL_CANDIDATES = [
  // 多个 GitHub 代理镜像
  'https://mirror.ghproxy.com/https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.1/PortableGit-2.47.1-64-bit.7z.exe',
  'https://gh-proxy.com/https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.1/PortableGit-2.47.1-64-bit.7z.exe',
  'https://kkgithub.com/git-for-windows/git/releases/download/v2.47.1.windows.1/PortableGit-2.47.1-64-bit.7z.exe',
  'https://ghfast.top/https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.1/PortableGit-2.47.1-64-bit.7z.exe',
  // GitLab.com 镜像（如果上面都不行）
  'https://gitlab.com/git-for-windows/git/-/jobs/artifacts/v2.47.1.windows.1/raw/PortableGit-2.47.1-64-bit.7z?job=msvc',
  // 备用官方源
  'https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.1/PortableGit-2.47.1-64-bit.7z.exe',
];
const DEST = path.join(process.env.TEMP || 'C:\\Users\\eva\\AppData\\Local\\Temp', 'PortableGit.exe');
const EXTRACT_DIR = 'C:\\Users\\eva\\tools\\PortableGit';

console.log(`Downloading from ${URL}...`);
console.log(`to ${DEST}`);

function download(url) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(DEST);
    https.get(url, { timeout: 120000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        try { fs.unlinkSync(DEST); } catch {}
        console.log('  redirect to', res.headers.location);
        return resolve(download(res.headers.location));
      }
      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(DEST); } catch {}
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let downloaded = 0;
      const total = parseInt(res.headers['content-length'] || '0', 10);
      res.on('data', (chunk) => {
        downloaded += chunk.length;
        if (total > 0 && downloaded % (5 * 1024 * 1024) < chunk.length) {
          const pct = ((downloaded / total) * 100).toFixed(1);
          process.stdout.write(`\r  ${(downloaded / 1024 / 1024).toFixed(1)}MB / ${(total / 1024 / 1024).toFixed(1)}MB (${pct}%)`);
        }
      });
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          process.stdout.write('\n');
          console.log(`Downloaded: ${(downloaded / 1024 / 1024).toFixed(1)} MB`);
          resolve(downloaded);
        });
      });
    }).on('error', (e) => {
      file.close();
      try { fs.unlinkSync(DEST); } catch {}
      reject(e);
    });
  });
}

async function downloadWithFallback() {
  for (const url of URL_CANDIDATES) {
    process.stdout.write(`Trying ${url.slice(0, 60)}... `);
    try {
      await download(url);
      return;
    } catch (err) {
      const code = err.code || err.message;
      process.stdout.write(`failed (${code})\n`);
    }
  }
  throw new Error('All sources failed');
}

(async () => {
  try {
    if (!fs.existsSync(DEST) || fs.statSync(DEST).size < 10 * 1024 * 1024) {
      await downloadWithFallback();
    } else {
      console.log(`Already downloaded: ${(fs.statSync(DEST).size / 1024 / 1024).toFixed(1)} MB`);
    }

    // 解压到目标目录
    if (fs.existsSync(EXTRACT_DIR)) {
      console.log(`Already extracted at ${EXTRACT_DIR}`);
    } else {
      console.log(`Extracting to ${EXTRACT_DIR}...`);
      fs.mkdirSync(EXTRACT_DIR, { recursive: true });
      execSync(`"${DEST}" -y -o"${EXTRACT_DIR}"`, { stdio: 'inherit' });
    }

    // 验证 git 可执行
    const gitExe = path.join(EXTRACT_DIR, 'cmd', 'git.exe');
    if (fs.existsSync(gitExe)) {
      const ver = execSync(`"${gitExe}" --version`).toString().trim();
      console.log(`✓ Git: ${ver}`);
      console.log(`\nUsage: "${gitExe}" <command>`);
    } else {
      throw new Error(`git.exe not found at ${gitExe}`);
    }
  } catch (err) {
    console.error('失败：', err.message);
    process.exit(1);
  }
})();
