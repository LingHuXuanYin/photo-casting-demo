// 下载 + 解压 Git for Windows portable
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const URL = 'https://gh-proxy.com/https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.1/PortableGit-2.47.1-64-bit.7z.exe';
const DEST = path.join(process.env.TEMP || 'C:\\Users\\eva\\AppData\\Local\\Temp', 'PortableGit.exe');
const EXTRACT_DIR = 'C:\\Users\\eva\\tools\\PortableGit';

function download() {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(DEST);
    let downloaded = 0;
    let total = 0;
    https.get(URL, { timeout: 180000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        try { fs.unlinkSync(DEST); } catch {}
        return resolve(download());
      }
      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(DEST); } catch {}
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      total = parseInt(res.headers['content-length'] || '0', 10);
      res.on('data', (chunk) => {
        downloaded += chunk.length;
        if (total > 0) {
          const pct = ((downloaded / total) * 100).toFixed(1);
          process.stdout.write(`\r  ${(downloaded/1024/1024).toFixed(1)}MB / ${(total/1024/1024).toFixed(1)}MB (${pct}%)`);
        }
      });
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          process.stdout.write('\n');
          resolve();
        });
      });
    }).on('error', (e) => {
      file.close();
      try { fs.unlinkSync(DEST); } catch {}
      reject(e);
    });
  });
}

(async () => {
  try {
    if (!fs.existsSync(DEST) || fs.statSync(DEST).size < 30 * 1024 * 1024) {
      console.log(`Downloading from ${URL}...`);
      await download();
      console.log('✓ Download complete');
    } else {
      console.log(`Already downloaded: ${(fs.statSync(DEST).size / 1024 / 1024).toFixed(1)} MB`);
    }

    if (fs.existsSync(path.join(EXTRACT_DIR, 'cmd', 'git.exe'))) {
      console.log(`Already extracted at ${EXTRACT_DIR}`);
    } else {
      console.log(`Extracting to ${EXTRACT_DIR}...`);
      fs.mkdirSync(EXTRACT_DIR, { recursive: true });
      // 7z 自解压格式，-y 覆盖，-o 指定输出目录
      execSync(`"${DEST}" -y -o"${EXTRACT_DIR}"`, { stdio: 'inherit' });
    }

    const gitExe = path.join(EXTRACT_DIR, 'cmd', 'git.exe');
    const ver = execSync(`"${gitExe}" --version`).toString().trim();
    console.log(`✓ Git installed: ${ver}`);
    console.log(`  Path: ${gitExe}`);
  } catch (err) {
    console.error('失败：', err.message);
    process.exit(1);
  }
})();
