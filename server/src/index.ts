/**
 * 模特卡片生成器 - 后端服务入口
 *
 * 启动方式：
 *   开发：npm run dev  (tsx watch)
 *   生产：npm run build && npm start
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { pingRoutes } from './routes/ping.js';
import { renderRoutes } from './routes/render.js';

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:5173';

async function bootstrap() {
  const app = Fastify({
    logger: {
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss' },
      },
    },
    // 允许较大的请求体：画布元素含 base64 图片，
    // 10 张图 ≈ 5-10MB，加上其他 JSON 字段需要更多
    bodyLimit: 50 * 1024 * 1024, // 50MB
  });

  // CORS: 允许本地 Vite 开发服务器
  await app.register(cors, {
    origin: [WEB_ORIGIN],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // 健康检查
  app.get('/health', async () => ({ status: 'ok', uptime: process.uptime() }));

  // 业务路由
  await app.register(pingRoutes, { prefix: '/api' });
  await app.register(renderRoutes, { prefix: '/api/cards' });

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`🚀 Server ready at http://localhost:${PORT}`);
    app.log.info(`🌐 Allowing CORS origin: ${WEB_ORIGIN}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

bootstrap();
