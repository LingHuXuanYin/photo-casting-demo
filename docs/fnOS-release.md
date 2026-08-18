# fnOS-release 分支说明

**专用于飞牛OS（FnOS）部署的稳定分支**。

## 与 master 的区别

| 项目 | master（开发主线） | fnOS-release（飞牛专用） |
|------|---------------------|--------------------------|
| Node 基础镜像 | `node:26-alpine` | `node:20-alpine` |
| `@napi-rs/canvas` | 最新可用版本 | `0.1.20`（SSE2 baseline，最广 CPU 兼容） |
| 端口 | 默认开发端口 | **10001 (web) / 10002 (server)** |
| Docker health check | 标准 | 放宽（start_period 30s + retries 6） |
| Web depends_on | `service_healthy` | `service_started`（不阻塞 UI） |
| npm registry | 默认 | `npmmirror.com`（国内加速） |
| 配置文件 | 散落在代码里 | `env_config/` 集中管理 |

## 为什么 master 跟 fnOS-release 分开

master 跟最新生态（Node 26、新 canvas 版本），适合本地 dev 和功能开发。
fnOS-release 是**飞牛OS NAS 实际部署**用的稳定版，针对**低功耗 NAS CPU** + **国内网络环境** + **避开 WebUI 80 端口**做了优化。

## 飞牛OS 部署流程

```bash
ssh root@飞牛IP
cd /vol1/1000/photo-casting-demo

# 1. 切到 fnOS-release 分支（首次或重置时）
git fetch origin
git checkout -b fnOS-release origin/fnOS-release
# 或者已经在 master 时：
# git checkout fnOS-release

# 2. 拉新 commit
git pull origin fnOS-release

# 3. 构建 + 启动
docker compose up -d --build

# 4. 验证
docker compose ps
docker compose logs --tail=100 server
# 期望看到 "Server listening at http://0.0.0.0:3001"
```

## 本地开发（仍在 master 分支）

```bash
git checkout master
npm run dev
# http://localhost:5173 看 web
# http://localhost:3001/api/ping 测 server
```

## 同步 master → fnOS-release

master 有新功能时：

```bash
git checkout fnOS-release
git merge master         # 把 master 的改动合并到 fnOS-release
# 如果有冲突，Dockerfile 的 node:20-alpine 跟 master 的 node:26-alpine 冲突时保留 20-alpine
git push origin fnOS-release
```

## 关键 commit（fnOS-release 上的飞牛OS 特定 commit）

```
3baafc0  Pin @napi-rs/canvas to 0.1.20 + adapt renderer for 0.1.20 sync API
b3902b6  Add env_config/ directory for centralized env management
7c4202b  web: depend on service_started instead of service_healthy
6dcce81  Relax health check start_period to absorb slow server cold start
4260332  Use npmmirror.com registry in Dockerfiles for faster China install
5bc1dd1  Fix Docker build: add per-workspace package-lock.json + unblock nginx.conf
083b9fa  Upgrade to Node 26 (...)          ← master 升级，但 fnOS-release 覆盖为 node:20
2c277cc  Switch Docker ports to 10001 / 10002
c41985f  Add Docker Compose deployment for 飞牛OS
```

## 验证清单

部署后跑：

```bash
# 1. Server 起来 + 健康
docker compose ps                    # 期望 model-card-server (healthy)
docker exec model-card-server sh -c 'wget -qO- http://localhost:3001/api/ping'
# 期望: {"status":"ok",...}

# 2. Web 反代 server
docker exec model-card-web sh -c 'wget -qO- http://model-card-server:3001/api/ping'
# 期望: {"status":"ok",...}

# 3. 浏览器访问
# http://飞牛IP:10001 → 看到 Dashboard
# 点导出 → 下载 JPG/PDF 文件
```

如果 502 / illegal instruction / unhealthy，按 `docs/部署到飞牛OS.md` 故障排除。
