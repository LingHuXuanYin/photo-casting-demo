// 全模板真实场景渲染测试
const http = require('http');
const fs = require('fs');
const path = require('path');

const MODEL = {
  name: '林若汐',
  englishName: 'Lin Ruoxi',
  height: '167cm',
  weight: '45kg',
  bwh: '73-62-83',
  shoe: '38',
  stats: '身高 167cm / 胸 73 / 腰 62 / 臀 83 / 鞋 38',
  contact: 'AGENCY · 星河模特经纪 · 微信 linruoxi_m',
};

const TEMPLATES = [
  {
    name: 'classic-portrait',
    canvas: { width: 595, height: 842, background: '#FFFFFF', unit: 'pt', name: 'A4 竖版' },
    elements: [
      // main + 3 aux placeholders
      { id: 'i1', type: 'image', x: 45, y: 45, w: 505, h: 480, rotation: 0, zIndex: 1, src: '', fit: 'cover', isPlaceholder: true },
      { id: 'i2', type: 'image', x: 45, y: 545, w: 165, h: 200, rotation: 0, zIndex: 3, src: '', fit: 'cover', isPlaceholder: true },
      { id: 'i3', type: 'image', x: 215, y: 545, w: 165, h: 200, rotation: 0, zIndex: 3, src: '', fit: 'cover', isPlaceholder: true },
      { id: 'i4', type: 'image', x: 385, y: 545, w: 165, h: 200, rotation: 0, zIndex: 3, src: '', fit: 'cover', isPlaceholder: true },
      { id: 'r1', type: 'rect', x: 45, y: 760, w: 505, h: 1, rotation: 0, zIndex: 5, fill: '#1a1d24', stroke: '#1a1d24', strokeWidth: 0, cornerRadius: 0 },
      { id: 't1', type: 'text', x: 45, y: 770, w: 250, h: 28, rotation: 0, zIndex: 6, content: MODEL.name, fontSize: 20, fontFamily: '"Inter", "Source Han Sans SC", sans-serif', fontStyle: 'bold', fill: '#1a1d24', textAlign: 'left', lineHeight: 1.2, linkedField: 'name' },
      { id: 't2', type: 'text', x: 45, y: 800, w: 280, h: 18, rotation: 0, zIndex: 6, content: MODEL.stats, fontSize: 11, fontFamily: '"Inter", "Source Han Sans SC", sans-serif', fontStyle: 'normal', fill: '#4a4f5a', textAlign: 'left', lineHeight: 1.2, linkedField: 'stats' },
      { id: 't3', type: 'text', x: 300, y: 770, w: 250, h: 18, rotation: 0, zIndex: 6, content: MODEL.contact, fontSize: 11, fontFamily: '"Inter", "Source Han Sans SC", sans-serif', fontStyle: 'normal', fill: '#4a4f5a', textAlign: 'right', lineHeight: 1.2, linkedField: 'contact' },
    ],
  },
  {
    name: 'black-white',
    canvas: { width: 1600, height: 800, background: '#FFFFFF', unit: 'pt', name: '黑白大片 1600×800' },
    elements: [
      { id: 'bg1', type: 'rect', x: 0, y: 0, w: 1600, h: 800, rotation: 0, zIndex: 0, fill: '#000000', stroke: '#000000', strokeWidth: 0, cornerRadius: 0 },
      { id: 'bg2', type: 'rect', x: 350, y: 0, w: 1250, h: 800, rotation: 0, zIndex: 0, fill: '#FFFFFF', stroke: '#FFFFFF', strokeWidth: 0, cornerRadius: 0 },
      { id: 't1', type: 'text', x: 40, y: 60, w: 270, h: 90, rotation: 0, zIndex: 1, content: MODEL.name, fontSize: 64, fontFamily: '"Source Han Sans SC", "Inter", sans-serif', fontStyle: 'bold', fill: '#FFFFFF', textAlign: 'left', lineHeight: 1, linkedField: 'name' },
      { id: 't2', type: 'text', x: 40, y: 220, w: 270, h: 22, rotation: 0, zIndex: 1, content: '身高 height', fontSize: 16, fontFamily: '"Inter", "Source Han Sans SC", sans-serif', fontStyle: 'normal', fill: '#FFFFFF', textAlign: 'left', lineHeight: 1 },
      { id: 't3', type: 'text', x: 40, y: 246, w: 270, h: 46, rotation: 0, zIndex: 1, content: MODEL.height, fontSize: 36, fontFamily: '"Inter", "Source Han Sans SC", sans-serif', fontStyle: 'bold', fill: '#FFFFFF', textAlign: 'left', lineHeight: 1, linkedField: 'height' },
      { id: 't4', type: 'text', x: 40, y: 320, w: 270, h: 22, rotation: 0, zIndex: 1, content: '体重 weight', fontSize: 16, fontFamily: '"Inter", "Source Han Sans SC", sans-serif', fontStyle: 'normal', fill: '#FFFFFF', textAlign: 'left', lineHeight: 1 },
      { id: 't5', type: 'text', x: 40, y: 346, w: 270, h: 46, rotation: 0, zIndex: 1, content: MODEL.weight, fontSize: 36, fontFamily: '"Inter", "Source Han Sans SC", sans-serif', fontStyle: 'bold', fill: '#FFFFFF', textAlign: 'left', lineHeight: 1, linkedField: 'weight' },
      { id: 't6', type: 'text', x: 40, y: 420, w: 270, h: 22, rotation: 0, zIndex: 1, content: '三围 BWH', fontSize: 16, fontFamily: '"Inter", "Source Han Sans SC", sans-serif', fontStyle: 'normal', fill: '#FFFFFF', textAlign: 'left', lineHeight: 1 },
      { id: 't7', type: 'text', x: 40, y: 446, w: 270, h: 46, rotation: 0, zIndex: 1, content: MODEL.bwh, fontSize: 36, fontFamily: '"Inter", "Source Han Sans SC", sans-serif', fontStyle: 'bold', fill: '#FFFFFF', textAlign: 'left', lineHeight: 1, linkedField: 'bwh' },
      { id: 't8', type: 'text', x: 40, y: 520, w: 270, h: 22, rotation: 0, zIndex: 1, content: '鞋码 shoe size', fontSize: 16, fontFamily: '"Inter", "Source Han Sans SC", sans-serif', fontStyle: 'normal', fill: '#FFFFFF', textAlign: 'left', lineHeight: 1 },
      { id: 't9', type: 'text', x: 40, y: 546, w: 270, h: 46, rotation: 0, zIndex: 1, content: MODEL.shoe, fontSize: 36, fontFamily: '"Inter", "Source Han Sans SC", sans-serif', fontStyle: 'bold', fill: '#FFFFFF', textAlign: 'left', lineHeight: 1, linkedField: 'shoe' },
      { id: 'i1', type: 'image', x: 380, y: 20, w: 460, h: 760, rotation: 0, zIndex: 1, src: '', fit: 'cover', isPlaceholder: true },
    ],
  },
];

function render(req) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(req);
    const httpReq = http.request({
      hostname: 'localhost', port: 3001, path: '/api/cards/render', method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(Buffer.concat(chunks));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${Buffer.concat(chunks).toString()}`));
        }
      });
    });
    httpReq.on('error', reject);
    httpReq.write(body);
    httpReq.end();
  });
}

(async () => {
  for (const t of TEMPLATES) {
    const out = path.join(__dirname, '..', `render-${t.name}.jpg`);
    try {
      const buf = await render({ format: 'jpg', scale: 1, canvas: t.canvas, elements: t.elements, filename: t.name });
      fs.writeFileSync(out, buf);
      console.log(`✓ ${t.name} → ${out} (${(buf.length/1024).toFixed(1)} KB)`);
    } catch (err) {
      console.error(`✗ ${t.name}: ${err.message}`);
    }
  }
})();
