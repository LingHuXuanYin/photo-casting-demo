#!/usr/bin/env node
/**
 * 下载字体到 server/fonts/
 *  - Source Han Sans SC (思源黑体) Regular + Bold: OFL 协议，免费可商用
 *  - Inter Regular + Bold: OFL 协议，免费可商用
 *
 * CDN 优先级：jsDelivr > unpkg > raw.githubusercontent.com
 * github.com 经常被墙或超时，所以走 jsDelivr。
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const FONTS_DIR = path.join(__dirname, '..', 'server', 'fonts');
if (!fs.existsSync(FONTS_DIR)) fs.mkdirSync(FONTS_DIR, { recursive: true });

// (file, list of candidate URLs)
const FONTS = [
  {
    file: 'SourceHanSansSC-Regular.otf',
    urls: [
      'https://cdn.jsdelivr.net/gh/adobe-fonts/source-han-sans@release/OTF/SimplifiedChinese/SourceHanSansSC-Regular.otf',
      'https://cdn.jsdelivr.net/gh/adobe-fonts/source-han-sans@release/OTF/SimplifiedChinese/SourceHanSansSC-Normal.otf',
    ],
  },
  {
    file: 'SourceHanSansSC-Bold.otf',
    urls: [
      'https://cdn.jsdelivr.net/gh/adobe-fonts/source-han-sans@release/OTF/SimplifiedChinese/SourceHanSansSC-Bold.otf',
    ],
  },
  {
    file: 'Inter-Regular.otf',
    urls: [
      'https://cdn.jsdelivr.net/gh/rsms/inter@master/docs/font-files/Inter-Regular.otf',
      'https://rsms.me/inter/font-files/Inter-Regular.otf',
    ],
  },
  {
    file: 'Inter-Bold.otf',
    urls: [
      'https://cdn.jsdelivr.net/gh/rsms/inter@master/docs/font-files/Inter-Bold.otf',
      'https://rsms.me/inter/font-files/Inter-Bold.otf',
    ],
  },
];

const MIN_VALID_SIZE = 50 * 1024; // < 50KB 视为下载失败

function downloadOnce(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    let downloaded = 0;
    const req = https.get(url, { timeout: 30000 }, (res) => {
      // 跟随重定向
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlink(dest, () => {});
        return resolve(downloadOnce(res.headers.location, dest));
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(dest, () => {});
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      res.on('data', (chunk) => {
        downloaded += chunk.length;
      });
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          if (downloaded < MIN_VALID_SIZE) {
            fs.unlink(dest, () => {});
            return reject(new Error(`File too small: ${downloaded} bytes`));
          }
          resolve(downloaded);
        });
      });
    });
    req.on('error', (err) => {
      file.close();
      fs.unlink(dest, () => {});
      reject(err);
    });
    req.on('timeout', () => {
      req.destroy(new Error('Request timeout'));
    });
  });
}

async function downloadWithFallback(file, urls) {
  const dest = path.join(FONTS_DIR, file);
  // 如果文件已存在且大小合理，跳过
  if (fs.existsSync(dest)) {
    const size = fs.statSync(dest).size;
    if (size > MIN_VALID_SIZE) {
      console.log(`[skip] ${file} (${(size / 1024 / 1024).toFixed(2)} MB already exists)`);
      return;
    }
    console.log(`[retry] ${file} exists but only ${size} bytes, re-downloading...`);
    fs.unlinkSync(dest);
  }

  let lastErr = null;
  for (const url of urls) {
    try {
      console.log(`[get] ${file} from ${url}`);
      const bytes = await downloadOnce(url, dest);
      console.log(`[ok]   ${file} (${(bytes / 1024 / 1024).toFixed(2)} MB)`);
      return;
    } catch (err) {
      lastErr = err;
      console.warn(`[fail] ${url}: ${err.message}`);
    }
  }
  throw new Error(`All sources failed for ${file}: ${lastErr?.message || 'unknown'}`);
}

(async () => {
  console.log(`Downloading fonts to ${FONTS_DIR}\n`);
  let failed = 0;
  for (const f of FONTS) {
    try {
      await downloadWithFallback(f.file, f.urls);
    } catch (err) {
      console.error(`✗ ${f.file}: ${err.message}\n`);
      failed++;
    }
  }
  console.log(`\n=== Summary ===`);
  const files = fs.readdirSync(FONTS_DIR).filter((n) => /\.(ttf|otf)$/i.test(n));
  for (const f of files) {
    const s = fs.statSync(path.join(FONTS_DIR, f));
    console.log(`  ${f}: ${(s.size / 1024 / 1024).toFixed(2)} MB`);
  }
  if (failed > 0) {
    console.log(`\n${failed} font(s) failed.`);
    process.exit(1);
  }
})();
