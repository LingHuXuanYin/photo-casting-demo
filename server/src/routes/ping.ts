/**
 * /api/ping 路由
 * 用于验证前后端联通，后续会被真实接口替换
 */

import type { FastifyInstance } from 'fastify';

export async function pingRoutes(app: FastifyInstance) {
  app.get('/ping', async () => ({
    status: 'ok',
    message: 'pong from model-card-server',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  }));
}
