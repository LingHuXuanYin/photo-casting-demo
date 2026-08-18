# 模特卡片生成器 (Model Card Generator)

> 上传照片 + 录入身材数据 + 拖拽画布 + 一键导出 JPG/PDF

[![Status](https://img.shields.io/badge/status-v0.5-brightgreen)]() [![Node](https://img.shields.io/badge/node-%3E%3D20-green)]()

## 📂 项目结构

```
photo-design/
├── docs/                              # 产品设计稿 + 迭代报告 + 部署文档
│   ├── 模特卡片生成器-产品原型设计.md
│   ├── 迭代开发报告-v0.1.md ~ v0.5.md
│   ├── fnOS-release.md                # fnOS-release 分支说明
│   ├── 部署到飞牛OS.md                # 飞牛OS 部署步骤
│   └── 部署到飞牛OS-实战复盘.md        # 踩坑复盘（强烈推荐阅读）
├── env_config/                        # 环境配置集中管理
│   ├── .env_default                   # 兜底
│   ├── .env_dev                       # 本地开发
│   ├── .env_fnOS                      # 飞牛OS 生产
│   ├── .env_local.example             # 个人本地示例（git 忽略 .env_local）
│   └── README.md
├── scripts/                           # 工具脚本
│   ├── check-ports.ps1                # 启动前端口预检（predev 钩子）
│   ├── load-env.js                    # 跨平台 env loader（npm run dev 自动 source）
│   ├── download-fonts.js              # 思源黑体下载（CDN fallback）
│   ├── download-inter.js              # Inter 下载（woff2 → ttf 转换）
│   ├── test-api.js                    # 后端 API 集成测试（23 用例）
│   ├── test-store.js                  # 前端 store / model 单元测试（46 用例）
│   └── test-all-templates.js          # 模板渲染回归测试
├── web/                               # 前端（Vite 6 + React 18 + TS + Konva）
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── canvas/                    # 画布编辑器 + Dashboard
│   ├── package.json
│   └── vite.config.ts
├── server/                            # 后端（Fastify 4 + TS + @napi-rs/canvas）
│   ├── src/
│   │   ├── index.ts                   # Fastify 入口
│   │   ├── routes/                    # ping, render
│   │   └── render/                    # 渲染器 + 字体管理
│   ├── fonts/                         # 内置字体（启动时自动注册）
│   │   ├── Inter-Regular.ttf
│   │   ├── Inter-Bold.ttf
│   │   ├── SourceHanSansSC-Regular.otf
│   │   └── SourceHanSansSC-Bold.otf
│   ├── Dockerfile                     # 多阶段 build
│   └── package.json
├── docker-compose.yml                 # web (10001) + server (10002) 编排
├── package.json                       # 根 workspaces 配置
├── fnOS-release                       # Git 分支：飞牛OS 部署专用
└── README.md                          # 你在这里
```

---

## 🚀 快速开始

### 1. 安装 Node.js 20+

```powershell
# 用 winget (推荐)
winget install OpenJS.NodeJS.LTS

# 或者直接下载安装
# https://nodejs.org/
```

### 2. 克隆 + 安装依赖

```powershell
git clone https://github.com/LingHuXuanYin/photo-casting-demo.git
cd photo-casting-demo
npm install
```

### 3. 启动开发服务

```powershell
# 一键启动前后端（自动从 env_config/.env_dev 加载环境变量）
npm run dev
```

启动后访问：

- **Web UI**：http://localhost:5173
- **Server API**：http://localhost:3001/api/ping
- **测试连接**：点击 web 上"🚀 测试连接"按钮，看到 `pong from model-card-server` = 前后端联通成功

### 4. 跑测试

```powershell
# 后端 API（23 用例）
node scripts/test-api.js

# 前端 store / model（46 用例）
node scripts/test-store.js

# 模板渲染（5 个内置模板）
node scripts/test-all-templates.js
```

### 5. 部署到飞牛OS

详细步骤看 [`docs/部署到飞牛OS.md`](docs/部署到飞牛OS.md)。先看的复盘看 [`docs/部署到飞牛OS-实战复盘.md`](docs/部署到飞牛OS-实战复盘.md)（踩坑 + 调试 checklist）。

```bash
ssh xiaoyin@飞牛IP
cd /vol1/1000/photo-casting-demo
git fetch origin
git checkout -b fnOS-release origin/fnOS-release
git pull origin fnOS-release
docker compose up -d --build

# 验证
docker compose ps                                       # 两个容器都 Up (healthy)
docker compose logs --tail=50 server                    # Server listening at 3001
curl http://localhost:10001                              # web 起来
# 浏览器打开 http://飞牛IP:10001 → 完整可用
```

---

## 🛠️ 技术栈

| 端 | 技术 |
|----|------|
| 前端 | Vite 6 + React 18 + TypeScript 5 + Konva.js |
| 后端 | Fastify 4 + TypeScript 5 + @napi-rs/canvas + pdf-lib + tsx (dev) |
| 存储 | 浏览器 IndexedDB（idb 库） |
| 字体 | Inter (拉丁) + 思源黑体 (CJK)，打包到 `server/fonts/` 启动时自动注册 |
| 部署 | Docker Compose + node:26-alpine + nginx:alpine + 国内 npm mirror |
| 构建 | npm workspaces + concurrently |

---

## 📍 端口分配

### 本地 dev

| 服务 | 端口 | 说明 |
|------|------|------|
| Web | 5173 | Vite dev server（带 HMR） |
| Server | 3001 | Fastify API |
| 代理 | /api/* | Vite 把 /api/* 代理到 3001 |

### 飞牛OS Docker 部署

| 服务 | 宿主端口 | 容器内端口 | 说明 |
|------|---------|-----------|------|
| Web | **10001** | 80 | 用户访问入口，浏览器开 `http://飞牛IP:10001` |
| Server | **10002** | 3001 | API 服务（一般通过 web 反代访问） |
| 容器间 | /api/* | 3001 | web 容器内 nginx 反代到 `model-card-server:3001` |

> 端口选 10001/10002 是为了避开飞牛OS WebUI 占用的 80 端口和常见 NAS 服务的 8080/5000。

---

## 🗺️ 开发路线

| 阶段 | 内容 | 状态 |
|------|------|------|
| P0-1 | 前后端骨架 + 联通 | ✅ |
| P0-2 | Konva.js 画布编辑器（拖拽/缩放/旋转/多选/撤销重做/对齐辅助线/图层面板/属性面板） | ✅ |
| P0-3 | IndexedDB 草稿（自动保存/启动加载/Ctrl+S） | ✅ |
| P0-4 | 模板系统（5 个内置模板：经典竖版/现代横版/极简方形/大片风格/黑白大片） | ✅ |
| P0-5 | 后端渲染（@napi-rs/canvas + pdf-lib，JPG/PDF，1x/2x） | ✅ |
| P0-6 | 端到端联调（自动化测试：后端 23 用例 + 前端 46 用例） | ✅ |
| P0-7 | 项目列表 UI（Dashboard + 缩略图 + 搜索 + 删除） | ✅ |
| **v0.5** | **飞牛OS Docker 部署 + 部署工具链** | **✅** |
| v1 内部发布 | 给模特试用，收集反馈 | 计划中 |
| v2 | 账号体系 / 云同步 / 投递记录 / 社区发现流 | 路线规划 |

详细规划见 `docs/模特卡片生成器-产品原型设计.md`，迭代进度见 `docs/迭代开发报告-v0.1.md` ~ `v0.5.md`。

---

## 🔤 字体说明

v1 阶段**所有字体都打包到 `server/fonts/`**，不依赖系统字体：

| 字体 | 用途 | 协议 |
|------|------|------|
| Source Han Sans SC Regular/Bold | 中文（CJK） | OFL（免费可商用） |
| Inter Regular/Bold | 英文 + 数字 | OFL（免费可商用） |

启动时 `server/src/render/fonts.ts` 会自动扫描并按文件名注册到 `@napi-rs/canvas`：
- `Inter-*.ttf` → 注册为 family `"Inter"`
- `SourceHanSansSC-*.otf` → 注册为 family `"Source Han Sans SC"`

模板的 fontFamily 都用 `'"Inter", "Source Han Sans SC", sans-serif'`，canvas 会自动按字符 fallback（中文走思源黑体，英文/数字走 Inter）。

如果字体文件丢失，可以重新下载：

```powershell
node scripts/download-fonts.js   # 思源黑体 ~32MB
node scripts/download-inter.js   # Inter ~120KB
```

---

## 📝 常用命令

```powershell
# 依赖
npm install                      # 装所有依赖（workspaces）
npm install --include=dev         # 包括 devDeps（本地 dev 需要）

# 开发
npm run dev                      # 一键启动前后端（自动 source env_config/.env_dev）
npm run dev:web                  # 仅前端
npm run dev:server               # 仅后端

# 测试
node scripts/test-api.js         # 后端 API
node scripts/test-store.js       # 前端 store
node scripts/test-all-templates.js

# 类型检查 + 构建
npm run typecheck                 # 跑所有 workspace 的 typecheck
npm run build                     # 生产构建

# 单个 workspace
npm run dev --workspace=web
npm run build --workspace=server

# 部署到飞牛OS
ssh xiaoyin@飞牛IP
cd /vol1/1000/photo-casting-demo
git pull origin fnOS-release
docker compose up -d --build
```

---

## 🔧 环境变量（env_config/）

所有环境变量集中在 `env_config/` 目录，**`npm run dev` 自动 source `env_config/.env_dev`**，docker 自动读 `env_config/.env_fnOS`。

**优先级**（后加载的覆盖前面的）：
```
.env_default   兜底
.env_dev       本地开发
.env_fnOS      飞牛OS 生产
.env_local     个人本地覆盖（git 忽略，最高优先级）
```

**常用变量**：

| 变量 | 默认 | 用途 |
|------|------|------|
| `NODE_ENV` | `production` | Node 模式（dev/production） |
| `PORT` | `3001` | Server 监听端口（容器内） |
| `HOST` | `0.0.0.0` | Server 绑定地址 |
| `WEB_ORIGIN` | `http://localhost:10001` | CORS 允许的 web 来源 |

**Docker 加载**：自动（`env_file: env_config/.env_fnOS`）

**本地 dev 加载**：自动（`scripts/load-env.js` 在 dev script 链里）

**本地 production 加载**：
```powershell
node scripts/load-env.js env_config/.env_fnOS -- node server/dist/index.js
```

详细看 [`env_config/README.md`](env_config/README.md)。

---

## 🌿 Git 分支

- **`main`**（默认）：开发主线。所有 P0 功能、bugfix、Node 26 / canvas 最新版
- **`fnOS-release`**：飞牛OS NAS 部署专用。包含 `env_config/`、部署文档、复盘报告

**日常 workflow**：
```bash
# 开发
git checkout main
git commit -m "..." ; git push origin main

# 飞牛OS 同步
git checkout fnOS-release
git merge main
git push origin fnOS-release
```

详细看 [`docs/fnOS-release.md`](docs/fnOS-release.md)。

---

## 📦 部署

### 飞牛OS NAS（当前唯一部署目标）

详细步骤看 [`docs/部署到飞牛OS.md`](docs/部署到飞牛OS.md)。

关键点：
- 基础镜像：`node:26-alpine` + `nginx:alpine`（你飞牛OS 本地要有）
- npm 源：`npmmirror.com`（国内加速）
- 端口：10001/10002（避开 80/8080/5000）
- 数据：用户项目存浏览器 IndexedDB，不在容器里

**部署必备**：
1. 飞牛OS 已装 Docker（v0.8+）
2. SSH 启用（普通用户 + sudo 权限即可）
3. 飞牛本地有 `node:26-alpine` 和 `nginx:alpine` 镜像
4. WebUI / 路由器防火墙放行 10001/10002 端口

### 复盘教训（强烈推荐阅读）

[`docs/部署到飞牛OS-实战复盘.md`](docs/部署到飞牛OS-实战复盘.md) 记录了：
- 10 阶段踩坑时间线
- 每个坑的真因 + 修法 + 关键经验
- 调试工具集（docker ps / logs / inspect / run --rm 顺序）
- 完整部署流程（普通用户 + sudo）
- 7 条复盘教训

---

## 📄 许可证

私有项目，v1 阶段。
