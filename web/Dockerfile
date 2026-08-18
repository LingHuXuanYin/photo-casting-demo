# 模特卡片生成器 - 前端 Dockerfile
#
# 多阶段构建：
#   Stage 1 (builder): 安装依赖 + Vite build 出静态文件
#   Stage 2 (nginx): nginx 托管静态文件 + 反向代理 /api 到后端

# ---- Stage 1: 构建 ----
# 飞牛OS 分支：用 node:20-alpine（NAPI 8 ABI 兼容 0.1.20 prebuild）
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY tsconfig.json tsconfig.node.json ./
COPY vite.config.ts ./
COPY index.html ./

# 走国内 npm 镜像，飞牛OS / 国内部署加速
RUN npm ci --registry=https://registry.npmmirror.com

COPY src ./src
RUN npm run build

# ---- Stage 2: nginx ----
FROM nginx:alpine

# 删掉默认配置
RUN rm /etc/nginx/conf.d/default.conf

# 拷 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 拷 Vite 产物
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
