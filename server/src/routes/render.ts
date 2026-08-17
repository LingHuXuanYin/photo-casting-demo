/**
 * POST /api/cards/render
 *
 * Body: RenderRequest (canvas meta + elements + format + scale + quality)
 * Response: image/jpeg 或 application/pdf 二进制流
 *
 * 性能考虑：
 *   - 同步返回（v1 单机无并发）
 *   - 大约 3-10 秒可出图
 *   - 图片按 base64 传过来，10 张图 ≈ 6-10MB
 */

import type { FastifyInstance } from 'fastify';
import { renderToBuffer } from '../render/renderer.js';
import { registerAllFonts } from '../render/fonts.js';
import type { RenderRequest } from '../render/types.js';

let fontsRegistered = false;

export async function renderRoutes(app: FastifyInstance) {
  // 启动时注册一次字体
  if (!fontsRegistered) {
    registerAllFonts();
    fontsRegistered = true;
  }

  app.post('/render', async (req, reply) => {
    const body = req.body as RenderRequest | undefined;
    if (!body || !body.canvas || !Array.isArray(body.elements)) {
      reply.code(400);
      return { error: 'Invalid request: canvas + elements required' };
    }
    if (body.format !== 'jpg' && body.format !== 'pdf') {
      reply.code(400);
      return { error: `Invalid format: ${body.format} (must be jpg or pdf)` };
    }

    const { canvas, elements, format, scale, quality } = body;
    if (!canvas.width || !canvas.height) {
      reply.code(400);
      return { error: 'canvas.width and canvas.height required' };
    }

    const start = Date.now();
    try {
      const { buffer, contentType, extension } = await renderToBuffer({
        canvas,
        elements,
        format,
        scale,
        quality,
      });

      // 原始名（用于 RFC 5987 编码，可能含中文/特殊字符）
      const rawName = (body.filename ?? 'model-card').trim().slice(0, 80) || 'model-card';
      // ASCII 备用名：老浏览器看到
      const asciiName = rawName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '') || 'model-card';
      // UTF-8 编码：现代浏览器看到
      const encodedName = encodeURIComponent(rawName);

      reply
        .code(200)
        .header('Content-Type', contentType)
        .header(
          'Content-Disposition',
          `attachment; filename="${asciiName}.${extension}"; filename*=UTF-8''${encodedName}.${extension}`,
        )
        .header('Content-Length', String(buffer.length))
        .header('X-Render-Ms', String(Date.now() - start));
      return reply.send(buffer);
    } catch (err) {
      app.log.error({ err }, 'Render error');
      reply.code(500);
      return { error: 'Render failed', message: (err as Error).message };
    }
  });
}
