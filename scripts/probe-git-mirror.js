// 探测 Git for Windows 镜像可用性
const https = require('https');
const http = require('http');

const URLS = [
  // GitHub 原始（已知超时）
  // 'https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.1/PortableGit-2.47.1-64-bit.7z.exe',
  // jsDelivr
  'https://cdn.jsdelivr.net/gh/git-for-windows/git@v2.47.1.windows.1/PortableGit-2.47.1-64-bit.7z.exe',
  // gh-proxy
  'https://gh-proxy.com/https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.1/PortableGit-2.47.1-64-bit.7z.exe',
  // ghfast.top
  'https://ghfast.top/https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.1/PortableGit-2.47.1-64-bit.7z.exe',
  // kkgithub
  'https://kkgithub.com/git-for-windows/git/releases/download/v2.47.1.windows.1/PortableGit-2.47.1-64-bit.7z.exe',
  // fastgit
  'https://download.fastgit.org/git-for-windows/git/releases/download/v2.47.1.windows.1/PortableGit-2.47.1-64-bit.7z.exe',
  // 阿里云镜像
  'https://npmmirror.com/mirrors/git-for-windows/PortableGit-2.47.1-64-bit.7z.exe',
  // 清华镜像
  'https://mirrors.tuna.tsinghua.edu.cn/github-release/git-for-windows/git/',
  // codeberg
  'https://codeberg.org/mirror/git-for-windows-mirror/raw/master/PortableGit-2.47.1-64-bit.7z.exe',
];

function head(url) {
  return new Promise((resolve) => {
    const mod = url.startsWith('http://') ? http : https;
    const req = mod.request(url, { method: 'HEAD', timeout: 15000 }, (res) => {
      resolve({ url, status: res.statusCode, len: res.headers['content-length'] });
    });
    req.on('error', (e) => resolve({ url, err: e.code || e.message }));
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.end();
  });
}

(async () => {
  for (const u of URLS) {
    process.stdout.write(`Probing ${u.slice(0, 60)}... `);
    const r = await head(u);
    if (r.status === 200) {
      console.log(`OK ${(r.len/1024/1024).toFixed(1)}MB`);
    } else if (r.status === 302 || r.status === 301) {
      console.log(`redirect ${r.status}`);
    } else {
      console.log(`FAIL ${r.status || r.err}`);
    }
  }
})();
