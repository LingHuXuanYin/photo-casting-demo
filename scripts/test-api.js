/**
 * 后端 API 集成测试（P0-6 联调）
 *
 * 覆盖：
 *   - 各种画布尺寸 / 格式 / 缩放
 *   - 边界 case：空项目、单元素、特殊字符文件名、scale 边界
 *   - 错误处理：缺字段、错字段、恶意输入
 *   - 字体 fallback 真实场景：中文 + 英文 + 数字混合
 *   - Content-Disposition 头（含中文文件名）
 *
 * 跑法：先启动 server（npm run dev -w server），然后 node scripts/test-api.js
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const HOST = 'localhost';
const PORT = 3001;
const RESULTS = [];

let _token = 0;
function logResult(name, ok, detail = '') {
  RESULTS.push({ name, ok, detail });
  const icon = ok ? '✓' : '✗';
  const color = ok ? '\x1b[32m' : '\x1b[31m';
  console.log(`${color}${icon}\x1b[0m ${name}${detail ? ' — ' + detail : ''}`);
}

function render(req, opts = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(req);
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
    };
    const r = http.request(
      { hostname: HOST, port: PORT, path: '/api/cards/render', method: 'POST', headers, ...opts },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks),
          });
        });
      },
    );
    r.on('error', reject);
    r.write(body);
    r.end();
  });
}

function makeRect(id, x, y, w, h, fill, zIndex = 0) {
  return { id, type: 'rect', x, y, w, h, rotation: 0, zIndex, fill, stroke: fill, strokeWidth: 0, cornerRadius: 0 };
}

function makeText(id, content, x, y, w, h, fontSize, fill, zIndex = 1, style = 'normal') {
  return {
    id, type: 'text', x, y, w, h, rotation: 0, zIndex,
    content, fontSize,
    fontFamily: '"Inter", "Source Han Sans SC", sans-serif',
    fontStyle: style, fill, textAlign: 'left', lineHeight: 1,
  };
}

function makeCanvas(w, h, bg = '#FFFFFF') {
  return { width: w, height: h, background: bg, unit: 'pt' };
}

async function expectSuccess(name, req) {
  try {
    const r = await render(req);
    if (r.status === 200 && r.body.length > 0) {
      logResult(name, true, `${r.body.length} bytes, ${r.headers['content-type']}`);
      return r;
    }
    logResult(name, false, `status=${r.status} body=${r.body.toString().slice(0, 100)}`);
    return null;
  } catch (e) {
    logResult(name, false, e.message);
    return null;
  }
}

async function expectFail(name, req, expectedStatus) {
  try {
    const r = await render(req);
    const ok = r.status === expectedStatus;
    logResult(name, ok, `expected ${expectedStatus}, got ${r.status}`);
    return r;
  } catch (e) {
    logResult(name, false, e.message);
    return null;
  }
}

async function run() {
  console.log('='.repeat(60));
  console.log('P0-6 后端 API 集成测试');
  console.log('='.repeat(60));

  // --- 基础渲染 ---
  await expectSuccess('空画布（无元素）', {
    format: 'jpg', canvas: makeCanvas(800, 600), elements: [],
  });

  await expectSuccess('单矩形', {
    format: 'jpg', canvas: makeCanvas(800, 600),
    elements: [makeRect('r1', 0, 0, 800, 600, '#ff0000')],
  });

  await expectSuccess('单文本 - 英文', {
    format: 'jpg', canvas: makeCanvas(800, 100),
    elements: [makeText('t1', 'Hello World', 10, 10, 780, 80, 48, '#000000')],
  });

  await expectSuccess('单文本 - 中文', {
    format: 'jpg', canvas: makeCanvas(800, 100),
    elements: [makeText('t1', '模特姓名', 10, 10, 780, 80, 48, '#000000')],
  });

  await expectSuccess('中英混合', {
    format: 'jpg', canvas: makeCanvas(800, 100),
    elements: [makeText('t1', '身高 height 165cm 体重 weight 45kg', 10, 10, 780, 80, 32, '#000000')],
  });

  // --- 格式 ---
  await expectSuccess('PDF 格式', {
    format: 'pdf', canvas: makeCanvas(595, 842), elements: [],
  });

  // --- scale / quality ---
  await expectSuccess('scale=1', {
    format: 'jpg', scale: 1, canvas: makeCanvas(400, 300), elements: [],
  });
  await expectSuccess('scale=2', {
    format: 'jpg', scale: 2, canvas: makeCanvas(400, 300), elements: [],
  });
  await expectSuccess('scale=4', {
    format: 'jpg', scale: 4, canvas: makeCanvas(400, 300), elements: [],
  });
  await expectSuccess('scale=99（应被 clamp 到 4）', {
    format: 'jpg', scale: 99, canvas: makeCanvas(400, 300), elements: [],
  });

  // --- 画布尺寸边界 ---
  await expectSuccess('超小画布 10x10', {
    format: 'jpg', canvas: makeCanvas(10, 10), elements: [],
  });
  await expectSuccess('超大画布 4000x4000', {
    format: 'jpg', canvas: makeCanvas(4000, 4000), elements: [],
  });
  await expectSuccess('非正方形 200x800', {
    format: 'jpg', canvas: makeCanvas(200, 800), elements: [],
  });

  // --- 错误处理 ---
  await expectFail('缺 format', { canvas: makeCanvas(100, 100), elements: [] }, 400);
  await expectFail('错 format', { format: 'gif', canvas: makeCanvas(100, 100), elements: [] }, 400);
  await expectFail('缺 canvas', { format: 'jpg', elements: [] }, 400);
  await expectFail('缺 elements', { format: 'jpg', canvas: makeCanvas(100, 100) }, 400);
  await expectFail('canvas.width 缺', { format: 'jpg', canvas: { height: 100 }, elements: [] }, 400);

  // --- 文件名（含中文 / 特殊字符）---
  const r1 = await expectSuccess('中文文件名', {
    format: 'jpg', filename: '林若汐的模卡', canvas: makeCanvas(100, 100), elements: [],
  });
  if (r1) {
    const cd = r1.headers['content-disposition'] || '';
    const ok = cd.includes("filename=\"") && cd.includes("filename*=UTF-8''");
    logResult('  → Content-Disposition 双格式', ok, cd.slice(0, 80) + '...');
  }

  await expectSuccess('特殊字符文件名', {
    format: 'jpg', filename: '模特 "卡" 100% / 2026', canvas: makeCanvas(100, 100), elements: [],
  });

  await expectSuccess('空文件名（应 fallback 到 model-card）', {
    format: 'jpg', filename: '', canvas: makeCanvas(100, 100), elements: [],
  });

  // --- 复杂场景：黑白大片 + 真实模特数据 ---
  const MODEL = {
    name: '林若汐',
    height: '167cm',
    weight: '45kg',
    bwh: '73-62-83',
    shoe: '38',
  };
  await expectSuccess('真实场景：黑白大片 1600x800', {
    format: 'jpg', filename: '林若汐-黑白大片',
    canvas: { width: 1600, height: 800, background: '#000000', unit: 'pt' },
    elements: [
      { id: 'bg1', type: 'rect', x: 0, y: 0, w: 1600, h: 800, rotation: 0, zIndex: 0, fill: '#000000', stroke: '#000000', strokeWidth: 0, cornerRadius: 0 },
      { id: 'bg2', type: 'rect', x: 350, y: 0, w: 1250, h: 800, rotation: 0, zIndex: 0, fill: '#FFFFFF', stroke: '#FFFFFF', strokeWidth: 0, cornerRadius: 0 },
      { id: 't1', type: 'text', x: 40, y: 60, w: 270, h: 90, rotation: 0, zIndex: 1, content: MODEL.name, fontSize: 64, fontFamily: '"Source Han Sans SC", "Inter", sans-serif', fontStyle: 'bold', fill: '#FFFFFF', textAlign: 'left', lineHeight: 1 },
      { id: 't2', type: 'text', x: 40, y: 220, w: 270, h: 22, rotation: 0, zIndex: 1, content: '身高 height', fontSize: 16, fontFamily: '"Inter", "Source Han Sans SC", sans-serif', fontStyle: 'normal', fill: '#FFFFFF', textAlign: 'left', lineHeight: 1 },
      { id: 't3', type: 'text', x: 40, y: 246, w: 270, h: 46, rotation: 0, zIndex: 1, content: MODEL.height, fontSize: 36, fontFamily: '"Inter", "Source Han Sans SC", sans-serif', fontStyle: 'bold', fill: '#FFFFFF', textAlign: 'left', lineHeight: 1 },
      { id: 't4', type: 'text', x: 40, y: 320, w: 270, h: 22, rotation: 0, zIndex: 1, content: '体重 weight', fontSize: 16, fontFamily: '"Inter", "Source Han Sans SC", sans-serif', fontStyle: 'normal', fill: '#FFFFFF', textAlign: 'left', lineHeight: 1 },
      { id: 't5', type: 'text', x: 40, y: 346, w: 270, h: 46, rotation: 0, zIndex: 1, content: MODEL.weight, fontSize: 36, fontFamily: '"Inter", "Source Han Sans SC", sans-serif', fontStyle: 'bold', fill: '#FFFFFF', textAlign: 'left', lineHeight: 1 },
      { id: 't6', type: 'text', x: 40, y: 420, w: 270, h: 22, rotation: 0, zIndex: 1, content: '三围 BWH', fontSize: 16, fontFamily: '"Inter", "Source Han Sans SC", sans-serif', fontStyle: 'normal', fill: '#FFFFFF', textAlign: 'left', lineHeight: 1 },
      { id: 't7', type: 'text', x: 40, y: 446, w: 270, h: 46, rotation: 0, zIndex: 1, content: MODEL.bwh, fontSize: 36, fontFamily: '"Inter", "Source Han Sans SC", sans-serif', fontStyle: 'bold', fill: '#FFFFFF', textAlign: 'left', lineHeight: 1 },
      { id: 't8', type: 'text', x: 40, y: 520, w: 270, h: 22, rotation: 0, zIndex: 1, content: '鞋码 shoe size', fontSize: 16, fontFamily: '"Inter", "Source Han Sans SC", sans-serif', fontStyle: 'normal', fill: '#FFFFFF', textAlign: 'left', lineHeight: 1 },
      { id: 't9', type: 'text', x: 40, y: 546, w: 270, h: 46, rotation: 0, zIndex: 1, content: MODEL.shoe, fontSize: 36, fontFamily: '"Inter", "Source Han Sans SC", sans-serif', fontStyle: 'bold', fill: '#FFFFFF', textAlign: 'left', lineHeight: 1 },
    ],
  });

  // --- 总结 ---
  console.log('\n' + '='.repeat(60));
  const passed = RESULTS.filter((r) => r.ok).length;
  const failed = RESULTS.length - passed;
  console.log(`总计: ${RESULTS.length} | 通过: ${passed} | 失败: ${failed}`);
  if (failed > 0) {
    console.log('\n失败项：');
    RESULTS.filter((r) => !r.ok).forEach((r) => console.log(`  - ${r.name}: ${r.detail}`));
    process.exit(1);
  }
  console.log('全部通过 ✓');
}

run().catch((err) => {
  console.error('test runner crashed:', err);
  process.exit(1);
});
