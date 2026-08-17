# 模特卡片生成器 - 后端 Dockerfile
#
# 多阶段构建：
#   Stage 1 (builder): 安装依赖 + 编译 TypeScript
#   Stage 2 (production): 只拷编译产物 + 生产依赖 + 字体文件

# ---- Stage 1: 构建 ----
FROM node:26-alpine AS builder

WORKDIR /app

# 先 COPY package.json 安装依赖（利用 Docker 缓存，依赖没变就不重装）
COPY package.json package-lock.json* ./
COPY tsconfig.json ./
RUN npm ci

# 拷贝源码并编译
COPY src ./src
COPY fonts ./fonts
RUN npm run build

# ---- Stage 2: 运行时 ----
FROM node:26-alpine

WORKDIR /app

ENV NODE_ENV=production

# 只装生产依赖
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# 拷编译产物 + 字体（字体打包在项目里，启动时自动注册到 @napi-rs/canvas）
COPY --from=builder /app/dist ./dist
COPY fonts ./fonts

EXPOSE 3001

# 启动后端
CMD ["node", "dist/index.js"]
