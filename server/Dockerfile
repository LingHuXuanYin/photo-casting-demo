# 模特卡片生成器 - 后端 Dockerfile
#
# 多阶段构建：
#   Stage 1 (builder): 安装依赖 + 编译 TypeScript
#   Stage 2 (production): 只拷编译产物 + 生产依赖 + 字体文件

# ---- Stage 1: 构建 ----
# 飞牛OS 分支：用 node:20-alpine（NAPI 8 ABI 完美兼容 0.1.20 prebuild，
# 避免 Node 26 的 NAPI 9 ABI 兼容性问题）
FROM node:20-alpine AS builder

WORKDIR /app

# 先 COPY package.json 安装依赖（利用 Docker 缓存，依赖没变就不重装）
COPY package.json package-lock.json* ./
COPY tsconfig.json ./
# 走国内 npm 镜像，飞牛OS / 国内部署加速
RUN npm ci --registry=https://registry.npmmirror.com

# 拷贝源码并编译
COPY src ./src
COPY fonts ./fonts
RUN npm run build

# ---- Stage 2: 运行时 ----
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# 只装生产依赖
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --registry=https://registry.npmmirror.com && npm cache clean --force

# 拷编译产物 + 字体（字体打包在项目里，启动时自动注册到 @napi-rs/canvas）
COPY --from=builder /app/dist ./dist
COPY fonts ./fonts

EXPOSE 3001

# 启动后端
CMD ["node", "dist/index.js"]
