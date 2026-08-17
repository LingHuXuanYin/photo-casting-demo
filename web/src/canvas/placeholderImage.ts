/**
 * 生成模板占位图（白底 + 居中文字）
 *
 * 用于模板应用时把"图片占位"矩形转换成 Image 元素，
 * 让用户在画布上看到一张带提示文字的白底图。
 *
 * 浏览器环境调用，使用 canvas 生成 PNG dataURL。
 */

export function generatePlaceholderDataURL(
  width: number,
  height: number,
  text: string = '双击上传照片',
): string {
  // 浏览器环境才生成（Node SSR 时返回空字符串兜底）
  if (typeof document === 'undefined') return '';

  const w = Math.max(50, Math.round(width));
  const h = Math.max(50, Math.round(height));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // 白色背景
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  // 浅灰虚线边框
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(1, 1, w - 2, h - 2);
  ctx.setLineDash([]);

  // 居中文字
  const fontSize = Math.max(14, Math.min(w, h) * 0.09);
  ctx.fillStyle = '#94a3b8';
  ctx.font = `${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2);

  return canvas.toDataURL('image/png');
}
