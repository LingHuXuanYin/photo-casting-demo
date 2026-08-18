/**
 * 模特卡片渲染器
 *
 * 输入：画布 JSON (CanvasMeta + Elements)
 * 输出：JPEG Buffer 或 PDF Buffer
 *
 * 渲染流程：
 *   1. 创建 canvas (width * scale, height * scale)
 *   2. 画背景色
 *   3. 按 zIndex 顺序绘制所有元素（图片 / 矩形 / 文字）
 *   4. 导出 Buffer
 */

import { createCanvas, Image, type SKRSContext2D } from '@napi-rs/canvas';
import { buildFontStack, parseFontStyle } from './fonts.js';
import type {
  CanvasElement,
  CanvasMeta,
  ImageElement,
  RectElement,
  TextElement,
} from './types.js';

const SCALE_MAX = 4;

/**
 * 把 dataURL 字符串转成 Buffer（@napi-rs/canvas 0.1.20 的 Image.src 同步接收 Buffer）
 *
 * 支持格式：data:image/<type>;base64,<base64-data>
 * 暂不支持远程 URL（v1 项目里所有图片都是 base64 内嵌）
 */
function srcToBuffer(src: string): Buffer {
  if (!src.startsWith('data:')) {
    throw new Error('当前仅支持 dataURL，传入的 src 看起来不像 dataURL');
  }
  const comma = src.indexOf(',');
  if (comma < 0) {
    throw new Error('dataURL 格式错误：缺少 , 分隔符');
  }
  return Buffer.from(src.slice(comma + 1), 'base64');
}

/**
 * 同步加载所有图片（@napi-rs/canvas 0.1.20 是同步 API）
 *
 * 0.1.20 的 Image 设 src 后立即可用，naturalWidth/naturalHeight 自动从图片元数据解析。
 * 没有 onload/onerror（这些是 0.1.50+ 才加的）。
 */
function loadImages(elements: CanvasElement[]): Map<string, Image> {
  const map = new Map<string, Image>();
  for (const el of elements) {
    if (el.type !== 'image' || !el.src || el.isPlaceholder) continue;
    try {
      const buffer = srcToBuffer(el.src);
      const img = new Image();
      img.src = buffer; // 0.1.20 同步解析，赋值后即可用
      map.set(el.id, img);
    } catch (err) {
      console.warn(`[render] 跳过无法加载的图片 ${el.id}:`, err);
    }
  }
  return map;
}

/**
 * 绘制单个元素
 */
function drawElement(
  ctx: SKRSContext2D,
  el: CanvasElement,
  scale: number,
  imageCache: Map<string, Image>,
): void {
  if (el.hidden) return;

  ctx.save();
  // 应用透明度（v2 再加 opacity 字段）
  // 应用旋转（绕中心）
  const cx = (el.x + el.w / 2) * scale;
  const cy = (el.y + el.h / 2) * scale;
  if (el.rotation) {
    ctx.translate(cx, cy);
    ctx.rotate((el.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  if (el.type === 'rect') {
    drawRect(ctx, el, scale);
  } else if (el.type === 'image') {
    drawImage(ctx, el, scale, imageCache);
  } else if (el.type === 'text') {
    drawText(ctx, el, scale);
  }

  ctx.restore();
}

function drawRect(ctx: SKRSContext2D, el: RectElement, scale: number) {
  const x = el.x * scale;
  const y = el.y * scale;
  const w = el.w * scale;
  const h = el.h * scale;
  const r = (el.cornerRadius ?? 0) * scale;

  ctx.fillStyle = el.fill;
  if (r > 0) {
    // 圆角矩形
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(x, y, w, h);
  }

  if (el.strokeWidth > 0 && el.stroke) {
    ctx.strokeStyle = el.stroke;
    ctx.lineWidth = el.strokeWidth * scale;
    if (r > 0) {
      // 圆角矩形 stroke（同 path）
      ctx.stroke();
    } else {
      ctx.strokeRect(x, y, w, h);
    }
  }
}

function drawImage(
  ctx: SKRSContext2D,
  el: ImageElement,
  scale: number,
  imageCache: Map<string, Image>,
) {
  const img = imageCache.get(el.id);
  if (!img) {
    // 占位图或加载失败：画灰底 + 虚线框 + 提示
    const x = el.x * scale;
    const y = el.y * scale;
    const w = el.w * scale;
    const h = el.h * scale;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.setLineDash([]);
    return;
  }
  const x = el.x * scale;
  const y = el.y * scale;
  const w = el.w * scale;
  const h = el.h * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (el.fit === 'cover') {
    // 缩放填满
    const ratio = Math.max(w / img.width, h / img.height);
    const dw = img.width * ratio;
    const dh = img.height * ratio;
    const dx = x + (w - dw) / 2;
    const dy = y + (h - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  } else {
    // contain：完整显示
    const ratio = Math.min(w / img.width, h / img.height);
    const dw = img.width * ratio;
    const dh = img.height * ratio;
    const dx = x + (w - dw) / 2;
    const dy = y + (h - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  }
  ctx.restore();
}

function drawText(ctx: SKRSContext2D, el: TextElement, scale: number) {
  const x = el.x * scale;
  const y = el.y * scale;
  const w = el.w * scale;

  const style = parseFontStyle(el.fontStyle);
  const sizePx = el.fontSize * scale;
  const lineHeightPx = sizePx * el.lineHeight;

  ctx.fillStyle = el.fill;
  // 用 buildFontStack 拼装带 CJK fallback 的字体栈
  ctx.font = buildFontStack(el.fontFamily, sizePx, style);
  ctx.textBaseline = 'top';
  ctx.textAlign = el.textAlign as 'left' | 'center' | 'right';

  // 计算 x 起始位置
  let textX = x;
  if (el.textAlign === 'center') textX = x + w / 2;
  else if (el.textAlign === 'right') textX = x + w;

  // 多行（按 \n 拆分）
  const lines = el.content.split('\n');
  let textY = y;
  for (const line of lines) {
    // @napi-rs/canvas 的 fillText 不支持 width 参数（自动换行）
    // v2 再做自动换行；v1 简单按 \n 分行
    ctx.fillText(line, textX, textY);
    textY += lineHeightPx;
  }
}

/**
 * 渲染主入口
 */
export async function renderToBuffer(args: {
  canvas: CanvasMeta;
  elements: CanvasElement[];
  format: 'jpg' | 'pdf';
  scale?: 1 | 2 | 4;
  quality?: number;
}): Promise<{ buffer: Buffer; contentType: string; extension: string }> {
  const scale = Math.min(SCALE_MAX, Math.max(1, args.scale ?? 1));
  const quality = Math.min(100, Math.max(1, args.quality ?? 92));

  const w = Math.round(args.canvas.width * scale);
  const h = Math.round(args.canvas.height * scale);

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');

  // 背景
  ctx.fillStyle = args.canvas.background || '#FFFFFF';
  ctx.fillRect(0, 0, w, h);

  // 预加载所有图片（0.1.20 同步）
  const imageCache = loadImages(args.elements);

  // 按 zIndex 排序后绘制
  const sorted = [...args.elements].sort((a, b) => a.zIndex - b.zIndex);
  for (const el of sorted) {
    drawElement(ctx, el, scale, imageCache);
  }

  if (args.format === 'jpg') {
    const buffer = canvas.toBuffer('image/jpeg', quality);
    return { buffer, contentType: 'image/jpeg', extension: 'jpg' };
  }
  if (args.format === 'pdf') {
    // PDF 走单独的封装函数
    return renderToPdf(canvas, args.canvas);
  }
  throw new Error(`Unsupported format: ${args.format}`);
}

async function renderToPdf(
  canvas: import('@napi-rs/canvas').Canvas,
  meta: CanvasMeta,
): Promise<{ buffer: Buffer; contentType: string; extension: string }> {
  // 先出 PNG buffer，再嵌入 PDF
  const pngBuffer = canvas.toBuffer('image/png');
  // 动态 import pdf-lib（避免冷启动耗时）
  const { PDFDocument } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.create();
  const pngImage = await pdfDoc.embedPng(pngBuffer);
  const page = pdfDoc.addPage([meta.width, meta.height]); // 1pt = 1/72 inch，PDF 也用 pt
  page.drawImage(pngImage, {
    x: 0,
    y: 0,
    width: meta.width,
    height: meta.height,
  });
  const pdfBytes = await pdfDoc.save();
  return {
    buffer: Buffer.from(pdfBytes),
    contentType: 'application/pdf',
    extension: 'pdf',
  };
}
