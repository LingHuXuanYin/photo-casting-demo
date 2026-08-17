# 部署到飞牛OS（Docker Compose）

> 适合飞牛OS（FnOS）0.8+ 用户。一键启动前后端，自动重启，开机自启。
> 预计耗时：**10-15 分钟**（包括 Docker 镜像构建）。

---

## 端口分配

| 服务 | 容器内端口 | 宿主机端口 | 说明 |
|------|------|------|------|
| `model-card-web` (应用端) | 80 | **10001** | 用户访问入口，浏览器打开 `http://飞牛IP:10001` |
| `model-card-server` (服务端) | 3001 | **10002** | API 服务（一般通过 web 反代访问，也可直连调试） |

> 💡 端口可以改：编辑 `docker-compose.yml` 的 `ports: "XXXX:80"` 和 `"YYYY:3001"` 即可。

---

## 方案概览

```
浏览器 ─HTTP─→ [model-card-web:10001] ── /api/* 反向代理 ──→ [model-card-server:10002]
                       ↓ nginx                                          ↓ Fastify + @napi-rs/canvas
                  静态文件托管                                      字体打包在容器里
```

- **前端**（model-card-web）：Vite build 静态文件 + nginx 托管 + /api 反代
- **后端**（model-card-server）：Node 20 + Fastify + @napi-rs/canvas，监听 3001
- **数据**：用户项目存浏览器 IndexedDB，**不在容器里**（重启不丢，换浏览器会丢）
- **导出文件**：用户从浏览器下载到本地

---

## 前置条件

### 1. 飞牛OS 已装 Docker

飞牛OS 0.8+ 通常自带 Docker。如果没装：
1. 飞牛OS WebUI → 应用中心 → 搜 "Docker" 或 "Container Manager"
2. 或者 SSH 进飞牛OS 跑：`docker --version` 看有没有

### 2. SSH 启用

飞牛OS WebUI → 系统设置 → SSH → 启用。

### 3. 知道飞牛OS 的 IP

一般是 `192.168.x.x`（局域网）。在 WebUI 首页能看到。

---

## 部署步骤

### 第 1 步：SSH 登录飞牛OS

在 Windows PowerShell（或任意 SSH 客户端）：

```bash
ssh root@192.168.x.x
```

> 飞牛OS 默认 root 账号，密码是 WebUI 登录密码。

### 第 2 步：安装 git + docker compose（如果没装）

```bash
# 检查
git --version
docker --version
docker compose version

# 如果缺 git（飞牛OS 默认没装）
apt update && apt install -y git

# 如果缺 docker compose v2（v1 是 `docker-compose` 命令）
# 飞牛OS 应用中心装 Docker 通常已带 v2
```

### 第 3 步：克隆仓库

```bash
# 推荐放 /vol1/1000/（飞牛OS 用户主目录，能在 WebUI 文件管理看到）
cd /vol1/1000
git clone https://github.com/LingHuXuanYin/photo-casting-demo.git
cd photo-casting-demo
```

### 第 4 步：自定义端口（可选）

默认端口：**应用端 10001，服务端 10002**（避开飞牛OS WebUI 的 80 端口）。

要改就编辑 `docker-compose.yml`：

```yaml
services:
  web:
    ports:
      - "你的端口:80"   # 例如 "11001:80"
  server:
    ports:
      - "你的端口:3001" # 例如 "11002:3001"
```

### 第 5 步：构建 + 启动

```bash
cd /vol1/1000/photo-casting-demo
docker compose up -d --build
```

首次构建大约 3-5 分钟（要 npm install + Vite build + 拉 nginx 镜像）。

构建完成后你会看到：

```
[+] Running 3/3
 ✔ Network model-card-net          Created
 ✔ Container model-card-server      Started
 ✔ Container model-card-web         Started
```

### 第 6 步：验证

```bash
# 看容器状态
docker compose ps

# 看后端日志（应该看到 "Server listening at http://0.0.0.0:3001"）
docker compose logs server

# 看前端日志（nginx 启动）
docker compose logs web

# 健康检查
docker compose exec server wget -qO- http://localhost:3001/api/ping
# 期望输出: {"status":"ok","message":"pong from model-card-server",...}
```

### 第 7 步：浏览器访问

打开 `http://飞牛OS的IP:10001`

例如：`http://192.168.1.100:10001`

应该看到 Dashboard（项目列表）界面。**注意：所有用户数据存在访问这个 URL 的浏览器 IndexedDB 里**，换浏览器/换电脑看不到。

---

## 飞牛OS 局域网访问配置

### 防火墙（如果连不上）

飞牛OS WebUI → 系统设置 → 防火墙 → 添加规则：
- 协议：TCP
- 端口：10001、10002（或你自定义的）
- 源 IP：局域网（如 `192.168.1.0/24`）或全部

### 反向代理（如果想用 80 端口）

飞牛OS WebUI → 反向代理 → 添加：
- 域名：你绑定的域名（如 `photo.example.com`）
- 目标：`http://localhost:10001`

记得域名解析 A 记录指向飞牛OS IP。

---

## 日常运维

```bash
cd /vol1/1000/photo-casting-demo

# 看实时日志
docker compose logs -f
docker compose logs -f server   # 只看后端
docker compose logs -f web      # 只看前端

# 重启服务（更新代码后用）
docker compose restart

# 停止服务
docker compose down

# 启动服务
docker compose up -d

# 重新构建（代码更新后）
git pull
docker compose up -d --build

# 清理（删容器 + 镜像，慎用）
docker compose down --rmi all
```

---

## 更新部署

飞牛OS 上：

```bash
cd /vol1/1000/photo-casting-demo
git pull origin master
docker compose up -d --build
```

`--build` 重新构建，`-d` 后台运行。会自动用新代码替换旧容器（数据无影响）。

---

## 数据备份 / 迁移

**重要：项目数据存在浏览器 IndexedDB，不在容器里。** 备份方案：

### 方案 A：手动导出

1. 在浏览器打开 WebUI
2. 选项目 → 导出 JPG（已经做了）
3. 用导出文件做备份

### 方案 B：IndexedDB 手动导出（高级）

1. 浏览器 DevTools（F12） → Application → Storage → IndexedDB
2. 右键 `model-card-db` → Export
3. 存到飞牛OS 文件系统

### 方案 C：未来加"项目导出 JSON"功能（v2）

`项目 → 导出 JSON 包` → 包含项目数据 + 图片，可在不同设备恢复。

---

## 故障排除

### 端口 10001 已占用

```bash
# 看谁占 10001
netstat -tlnp | grep 10001    # Linux

# 改 docker-compose.yml 的端口映射
ports:
  - "11001:80"   # 换 11001
```

### 容器一直重启（exit code 1）

```bash
docker compose logs server
```

常见原因：
- 字体文件丢失（检查 `server/fonts/` 是否有 4 个文件）
- Node.js 版本不兼容（确认用 `node:20-alpine`）

### 浏览器能看到 Dashboard 但导出失败

```bash
# 看后端日志
docker compose logs -f server
```

可能：
- 字体注册失败（看日志第一行）
- 图片 base64 太大（前端 fetch 报 413 错误）

### 改了代码但页面没更新

浏览器硬刷新 `Ctrl + Shift + R`（Win）/ `Cmd + Shift + R`（Mac）。

或者确认 `docker compose up -d --build` 真的跑过了（构建会重生成容器）。

### 内存不够（OOM）

导出大画布（4000×4000 + 16 个元素）可能用到 500MB+ 内存。`docker-compose.yml` 里 server 限制 1G，必要时调大：

```yaml
deploy:
  resources:
    limits:
      memory: 2G   # 改这里
```

---

## 反向代理到域名（高级）

如果你有公网域名，想用 `photo.example.com` 访问：

### 1. DNS 解析

A 记录：`photo.example.com` → 飞牛OS 公网 IP

### 2. 飞牛OS 反向代理

飞牛OS WebUI → 反向代理 → 添加：
- 域名：`photo.example.com`
- 协议：HTTPS（推荐）+ Let's Encrypt 自动证书
- 反代目标：`http://localhost:10001`

### 3. 验证

浏览器打开 `https://photo.example.com`，应该能看到 Dashboard。

---

## 卸载

```bash
cd /vol1/1000/photo-casting-demo
docker compose down
cd ..
rm -rf photo-casting-demo
```

容器、镜像、网络都会清理掉。**项目数据（IndexedDB）不受影响**（在用户浏览器里）。

---

## 完整文件结构

部署到飞牛OS 后，飞牛OS 上的目录：

```
/vol1/1000/photo-casting-demo/
├── docker-compose.yml       # 一键编排
├── .git/                    # git 仓库
├── server/
│   ├── Dockerfile           # 后端镜像构建
│   ├── .dockerignore
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/                 # TypeScript 源码
│   └── fonts/               # 4 个字体（构建时 COPY 进镜像）
└── web/
    ├── Dockerfile           # 前端镜像构建
    ├── .dockerignore
    ├── nginx.conf           # nginx 配置（含 /api 反代）
    ├── package.json
    ├── tsconfig.json
    ├── tsconfig.node.json
    ├── vite.config.ts
    ├── index.html
    └── src/                 # React 源码
```

容器里：
- `model-card-server`：`/app/dist/index.js` 启动
- `model-card-web`：nginx 服务 `/usr/share/nginx/html`

---

## 常见问题

### Q1：可以挂载导出目录到飞牛OS 共享盘吗？

可以。改 `docker-compose.yml`：

```yaml
services:
  server:
    volumes:
      - /vol1/1000/photo-design-exports:/app/exports
```

但当前后端实现是直接把渲染结果返回给浏览器下载，不存到容器。**需要改后端代码支持 server-side 保存才能用**（v2 功能）。

### Q2：可以多用户吗？

可以！只要局域网/外网的人能访问 `http://飞牛IP:10001`，任何浏览器都能用。但**数据各自隔离**（每人的 IndexedDB 独立）。

要"多用户共享项目数据"需要：
- 改 IndexedDB 存到后端
- 加账号体系

这是 v2+ 范围。

### Q3：可以装在外网访问吗？

可以。确保：
1. 飞牛OS 防火墙开放 10001（或反代到 443）
2. 路由器端口转发 10001 → 飞牛OS
3. 公网 IP 或 DDNS 域名

但 **强烈建议加 HTTPS**（飞牛OS 反代里配 Let's Encrypt 自动证书）。

### Q4：能跟飞牛OS 的 WebUI 共存吗？

能。飞牛OS WebUI 占 80，我们的前端用 10001 避开。用户访问：
- 飞牛OS WebUI：`http://飞牛IP`
- 模特卡片：`http://飞牛IP:10001`

或者在飞牛OS WebUI 反代里配 `photo.example.com` 转发到 `localhost:10001`，就能用 80/443 标准端口。

---

*文档版本：v1.1 · 2026-08-18*
*作者：Mavis*
