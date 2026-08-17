// 从 @fontsource 拉 Inter 的 WOFF2，再用 wawoff2 转成 TTF 存到 server/fonts/
const https = require('https');
const fs = require('fs');
const path = require('path');
const wawoff2 = require('wawoff2');

const FONTS_DIR = path.join(__dirname, '..', 'server', 'fonts');

// fontsource v5: files/inter-latin-{weight}-normal.woff2
const INTER = [
  { weight: 400, out: 'Inter-Regular.ttf' },
  { weight: 700, out: 'Inter-Bold.ttf' },
];
const BASE = 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.16/files';

function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 30000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(download(res.headers.location));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

(async () => {
  for (const { weight, out } of INTER) {
    const url = `${BASE}/inter-latin-${weight}-normal.woff2`;
    const dest = path.join(FONTS_DIR, out);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 50 * 1024) {
      console.log(`[skip] ${out}`);
      continue;
    }
    try {
      console.log(`[get] ${url}`);
      const woff2 = await download(url);
      console.log(`[convert] ${woff2.length} bytes woff2 -> ttf`);
      const ttf = await wawoff2.decompress(woff2);
      fs.writeFileSync(dest, Buffer.from(ttf));
      console.log(`[ok]   ${out} (${(ttf.length / 1024).toFixed(1)} KB)`);
    } catch (err) {
      console.error(`[fail] ${out}: ${err.message}`);
      process.exit(1);
    }
  }
  console.log('\n=== final ===');
  for (const f of fs.readdirSync(FONTS_DIR).filter((n) => /\.(ttf|otf)$/i.test(n))) {
    const s = fs.statSync(path.join(FONTS_DIR, f));
    console.log(`  ${f}: ${(s.size / 1024).toFixed(1)} KB`);
  }
})();
