# 模特卡片生成器 (Model Card Generator)

> 上传照片 + 录入身材数据 + 拖拽画布 + 一键导出 JPG/PDF

[![Status](https://img.shields.io/badge/status-P0--1-yellow)]() [![Node](https://img.shields.io/badge/node-%3E%3D18.18-green)]()

## 📂 项目结构

```
photo-design/
├── docs/                       # 产品设计稿 + 迭代报告
│   ├── 模特卡片生成器-产品原型设计.md
│   ├── 迭代开发报告-v0.1.md
│   └── 迭代开发报告-v0.2.md
├── web/                        # 前端 (Vite + React + TS + Konva)
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── canvas/             # 画布编辑器相关
│   ├── package.json
│   └── vite.config.ts
├── server/                     # 后端 (Fastify + TS + @napi-rs/canvas)
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/             # ping, render
│   │   └── render/             # 渲染器 + 字体管理
│   ├── fonts/                  # 内置字体 (启动时自动注册)
│   │   ├── Inter-Regular.ttf
│   │   ├── Inter-Bold.ttf
│   │   ├── SourceHanSansSC-Regular.otf
│   │   └── SourceHanSansSC-Bold.otf
│   └── package.json
├── scripts/                    # 工具脚本
│   ├── check-ports.ps1         # 启动前端口预检 (predev 钩子)
│   ├── download-fonts.js       # 思源黑体下载 (CDN fallback)
│   ├── download-inter.js       # Inter 下载 (woff2 → ttf 转换)
│   └── test-all-templates.js   # 渲染回归测试
├── package.json                # 根 workspaces 配置
└── README.md
```

## 🚀 快速开始

### 1. 安装 Node.js 18.18+

```powershell
# 用 winget (推荐)
winget install OpenJS.NodeJS.LTS

# 或者直接下载安装
# https://nodejs.org/
```

### 2. 安装依赖

```powershell
cd C:\Users\eva\Documents\photo-design
npm install
```

### 3. 启动开发服务

```powershell
# 一键启动前后端 (推荐)
npm run dev

# 或单独启动
npm run dev:web      # 前端 http://localhost:5173
npm run dev:server   # 后端 http://localhost:3001
```

### 4. 验证联通

打开 http://localhost:5173 ，点击 "🚀 测试连接" 按钮。
- ✅ 看到 `pong from model-card-server` = 前后端联通成功
- ❌ 看到红色错误 = 检查后端是否启动

## 🛠️ 技术栈

| 端 | 技术 |
|----|------|
| 前端 | Vite 5 + React 18 + TypeScript 5 + Konva.js |
| 后端 | Fastify 4 + TypeScript 5 + @napi-rs/canvas + pdf-lib + tsx (dev) |
| 存储 | 浏览器 IndexedDB（idb 库） |
| 字体 | Inter (拉丁) + 思源黑体 (CJK)，打包到 `server/fonts/` 启动时自动注册 |
| 构建 | npm workspaces + concurrently |

## 📍 端口分配

| 服务 | 端口 | 说明 |
|------|------|------|
| Web | 5173 | Vite dev server |
| Server | 3001 | Fastify API |
| 代理 | /api/* | Vite 把 /api/* 代理到 3001 |

## 🗺️ 开发路线

| 阶段 | 内容 | 状态 |
|------|------|------|
| P0-1 | 前后端骨架 + 联通 | ✅ 已完成 |
| P0-2 | Konva.js 画布编辑器（拖拽/缩放/旋转/多选/撤销重做/对齐辅助线/图层面板/属性面板） | ✅ 已完成 |
| P0-3 | IndexedDB 草稿（自动保存/启动加载/Ctrl+S） | ✅ 已完成 |
| P0-4 | 模板系统（5 个内置模板：经典竖版/现代横版/极简方形/大片风格/黑白大片） | ✅ 已完成 |
| P0-5 | 后端渲染（@napi-rs/canvas + pdf-lib，JPG/PDF，1x/2x） | ✅ 已完成 |
| P0-6 | 端到端联调（自动化测试：后端 23 用例 + 前端 46 用例） | ✅ 已完成 |
| P0-7 | 项目列表 UI（Dashboard + 缩略图 + 搜索 + 删除） | ✅ 已完成 |

**v1 所有 P0 阶段完成。** 详细规划见 `docs/模特卡片生成器-产品原型设计.md`，迭代进度见 `docs/迭代开发报告-v0.1.md` ~ `v0.4.md`。

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
# 下载思源黑体（~32MB，jsDelivr CDN）
node scripts/download-fonts.js

# 下载 Inter 并把 woff2 转成 ttf（~120KB）
node scripts/download-inter.js
```

## 📝 常用命令

```powershell
# 安装所有依赖
npm install

# 一键启动开发 (推荐)
npm run dev

# 仅启动前端
npm run dev:web

# 仅启动后端
npm run dev:server

# 类型检查
npm run typecheck

# 构建生产版本
npm run build

# 联调测试（后端 API + 前端 store + 模板渲染）
node scripts/test-api.js
node scripts/test-store.js
node scripts/test-all-templates.js
```

## 🔧 环境变量

后端 `server/.env`（可选）：

```env
PORT=3001
HOST=0.0.0.0
WEB_ORIGIN=http://localhost:5173
```

前端 `web/.env`（可选）：

```env
VITE_API_BASE=/api
```

## 📄 许可证

私有项目，v1 阶段。
