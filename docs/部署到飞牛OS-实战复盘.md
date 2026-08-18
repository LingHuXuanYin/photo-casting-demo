# 飞牛OS 部署实战复盘（v0.5）

> 记录 **fnOS-release** 分支从无到有的完整过程：所有坑、调试手段、最终修法。
> 写给"以后再部署一次"或"遇到类似问题"的自己 / 协作者。

## TL;DR

**最关键的发现**：502 / unhealthy / 容器反复重启，**真因不是** `@napi-rs/canvas` CPU 指令不兼容、不是 nginx 反代不通、不是 health check 太严——而是 `pino-pretty`（devDep）没装，server 启动立刻崩。

修了 1 行代码（`server/src/index.ts` 加 dev/prod 分支判断）就解决了**所有**问题。

之前 9 次降级 canvas、换 Node 版本、放松 health check、改 depends_on 等**都跟真因无关**。

---

## 时间线（按发生顺序）

| # | 阶段 | 问题 | 误判 | 实际修法 |
|---|------|------|------|----------|
| 1 | 基础镜像 | `docker.io` 401，飞牛代理不通 | 以为是网络封禁 | 复用本地已有 `node:26-alpine` / `nginx:alpine` |
| 2 | 第一次 build | server `npm ci` 找不到 lock | 以为是 npm bug | npm 7+ workspaces 把 lock 集中在根目录，给 server/ web/ 各生成一份 lock |
| 3 | 第一次 build | `COPY nginx.conf` 失败 | 以为是 COPY 路径错 | `web/.dockerignore` 把 `nginx.conf` 排除了，删掉那行 |
| 4 | build 慢 | `registry.npmjs.org` 拉包超时 | 以为是网络问题 | Dockerfile 加 `--registry=https://registry.npmmirror.com` |
| 5 | 容器启动 | server 一直 unhealthy | 以为是 health check 太严 | 把 start_period 10s→30s，retries 3→6，interval 30s→10s |
| 6 | web 不起 | depends_on service_healthy 卡住 | 以为是 server 配置错 | 改 web depends_on 为 `service_started`（让 UI 至少能看） |
| 7 | 报 illegal instruction | 用户报 server 崩 | 误判为 @napi-rs/canvas CPU 指令 | 降级 canvas 1.0.6→0.1.100→0.1.50（失败）→0.1.20 |
| 8 | 换基础镜像 | 担心 NAPI ABI 不兼容 | 误判为 NAPI 9 ↔ 6 不兼容 | 换 node:26-alpine → node:20-alpine |
| 9 | **真因发现** | 用户跑 `sudo docker logs model-card-server` | — | **真因是 `pino-pretty` devDep 缺失** |
| 10 | 真正修复 | 改 `server/src/index.ts` 加 dev/prod 分支 | — | dev 用 pino-pretty，prod 用 pino 默认 JSON |

---

## 每个坑详解

### 坑 1：飞牛代理 401（基础镜像拉不到）

**错误**：
```
web Warning Get "https://registry-1.docker.io/v2/": dial tcp 199.16.158.12:443: connect: connection refused
ERROR: unexpected status from HEAD request to https://docker.fnnas.com/v2/library/nginx/manifests/alpine?ns=docker.io: 401 Unauthorized
```

**真因**：飞牛OS WebUI 走的是 `docker.fnnas.com` 镜像代理，需要登录飞牛云账号才能用。docker daemon 走的是 `docker.io` 直连，被封了。

**修法**：让用户**先在本地 Windows 拉基础镜像**（用 Docker Desktop 走国内网络），然后用 `docker save` 传到飞牛OS `docker load`——但太麻烦。

**实际**：用户本地 Docker Desktop 没装。**用本地已有镜像**（用户 Windows 上的 `node:26-alpine` 来自之前测试），build 阶段会从本地缓存 layer 拉（`DONE 0.0s`），跳过远端。

**关键经验**：
- 飞牛OS 第一次 build 前，**确保 `node:20-alpine` 或 `node:26-alpine` 在飞牛本地**（`sudo docker images | grep node`）
- 没的话用 `docker pull` 通过 daemon 直接拉（**绕过 WebUI**），用国内镜像：
  ```bash
  sudo docker pull docker.m.daocloud.io/library/node:20-alpine
  sudo docker tag docker.m.daocloud.io/library/node:20-alpine node:20-alpine
  ```

---

### 坑 2：workspaces 模式下 server/ 没有 lock 文件

**错误**：
```
npm error The `npm ci` command can only install with an existing package-lock.json
```

**真因**：npm 7+ workspaces 把所有子 workspace 的依赖信息集中到**根目录** `package-lock.json` 里，子 workspace 各自没有 `package-lock.json`。但 server 的 Dockerfile 单独 build server 目录，`npm ci` 找不到 lock。

**修法**：在 server/ 和 web/ 各自生成一份 lock 文件：

```bash
cd server
npm install --package-lock-only --no-workspaces
# 这会生成 server/package-lock.json（仅含 server 自己的依赖）
cd ../web
npm install --package-lock-only --no-workspaces
```

**关键经验**：
- 根 lock 仍然有效（dev 用 workspaces 模式）
- 子 lock 独立（Docker 单 workspace build 用）
- 两个 lock 应该版本一致（子 lock 是子集）

---

### 坑 3：`.dockerignore` 把 nginx.conf 排了

**错误**：
```
ERROR: failed to calculate checksum of ref ...: "/nginx.conf": not found
```

**真因**：`web/.dockerignore` 之前为了排除无关文件，把 `nginx.conf` 也加进去了。Docker COPY 时从 build context 找不到。

**修法**：删掉 `.dockerignore` 里的 `nginx.conf` 那行。

**关键经验**：
- **永远不要把要 COPY 的文件加进 .dockerignore**
- .dockerignore 应该只排除 build context 里**存在但不需要**的东西

---

### 坑 4：npm install 慢 / 超时

**错误**：
```
npm error code ETIMEDOUT
```

**真因**：`registry.npmjs.org` 在国内访问慢/不稳。

**修法**：Dockerfile 所有 `npm ci` 加 `--registry=https://registry.npmmirror.com`（淘宝镜像，国内 CDN）。

**关键经验**：
- 飞牛OS 在国内，**永远**用 npmmirror 而不是 npmjs.org
- 也可以用 `.npmrc` 文件，但命令行参数更直接

---

### 坑 5：server unhealthy 卡住

**现象**：`docker compose ps` 显示 `model-card-server (unhealthy)`，web 容器不启动（因为 depends_on `service_healthy`）。

**真因**（当时误判）：以为是 server 启动慢，health check 30s 内失败。

**修法（事后看是冤枉路）**：
- `start_period: 10s → 30s`（health check 前多等 20s）
- `interval: 30s → 10s`（启动后密集探测）
- `retries: 3 → 6`（容忍 6 次连续失败）

**事后看**：这些改动**没影响真因**。server 启动后**立刻 crash**（pino-pretty 缺失），但因为 restart 循环太频繁，30s 启动期内可能看起来"启动中"，误判为"启动慢"。

---

### 坑 6：web depends_on 卡住

**修法**：web depends_on `condition: service_healthy` → `service_started`。

**事后看**：这也是冤枉路。但作为**临时方案**有价值——至少让 UI 能看，导出 API 调用失败也能立即知道是 server 端问题。

**事后看**：**真因修好后**，server 正常起来 healthy，depends_on 改回 `service_healthy` 也没问题。是否改回，看你喜好。

---

### 坑 7-8：illegal instruction（误判）

**用户报**："illegal instruction (core dumped)"

**误判路径**：
1. 以为是 `@napi-rs/canvas@1.0.6` 用了 AVX/AVX2 指令，飞牛OS NAS 的 Atom/J4125/N100 CPU 不支持
2. 降级到 `0.1.100`（4 月底，Skia baseline 老一点）
3. 仍报，降级到 `0.1.50` → typecheck 失败（Image API 改了，src 是 Buffer 不是 string）
4. 降级到 `0.1.20`（2022-08，Skia baseline 最老） → typecheck 又失败
5. 改 renderer.ts 适配 Buffer API
6. 改基础镜像到 `node:20-alpine`（担心 NAPI ABI 9 ↔ 6 不兼容）
7. **仍然报**

**真相**：**根本没有 illegal instruction**。`docker logs` 显示的是 `unable to determine transport target for "pino-pretty"`——**pino-pretty 缺失**导致 server 立刻 crash，crash 后容器退出码可能是某个 signal，被误读为"illegal instruction"。

或者之前的 `illegal instruction (core dumped)` 可能是用户从某个 web 工具（飞牛OS WebUI / 旧 docker logs）复制的过期/混淆信息。

**关键教训**：
- **永远先看 `docker logs <container>` 看真实错误**，不要从 build log 推断
- "illegal instruction" 不一定是 CPU 指令，可能是其他 native module 加载失败
- 真因是 1 行代码的判断分支错误（dev vs prod logger）

---

### 坑 9：真因——`pino-pretty` 缺失

**错误（用户贴的真实日志）**：
```
Error: unable to determine transport target for "pino-pretty"
    at fixTarget (/app/node_modules/pino/lib/transport.js:160:13)
    at transport (/app/node_modules/pino/lib/transport.js:130:22)
    at createLogger (/app/node_modules/fastify/lib/logger.js:101:18)
    at fastify (/app/node_modules/fastify/fastify.js:135:33)
    at bootstrap (file:///app/dist/index.js:16:17)
```

**真因**：
- `pino-pretty` 在 `server/package.json` 的 `devDependencies` 里
- Dockerfile 跑 `npm ci --omit=dev`（生产环境不要 devDeps）
- `server/src/index.ts` 写死了用 `transport: { target: 'pino-pretty' }`
- 容器启动时找不到 pino-pretty → 立刻 crash

**修法**：`server/src/index.ts` 加 dev/prod 分支：

```ts
const isDev = process.env.NODE_ENV !== 'production';
const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
    ...(isDev && {
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss' },
      },
    }),
  },
  bodyLimit: 50 * 1024 * 1024,
});
```

dev (`npm run dev`) 看到 `NODE_ENV=undefined` → `isDev=true` → 用 pino-pretty（带颜色好看）
prod (容器 `env_config/.env_fnOS` 设 `NODE_ENV=production`) → `isDev=false` → 用 pino 默认 JSON 输出到 stdout

---

## 调试工具集

按使用顺序，越靠后越准：

| 阶段 | 工具 | 看什么 |
|------|------|--------|
| 1 | `docker compose ps` | 容器状态：Up / Restarting / unhealthy |
| 2 | `docker compose logs --tail=200 server` | server 的 stdout/stderr（**最关键**） |
| 3 | `docker inspect <container> --format='{{.State.ExitCode}}'` | 容器退出码（137=OOM, 1=应用错, 132=illegal instruction） |
| 4 | `docker run -it --rm --entrypoint sh <image>` + 手动跑 `node dist/index.js` | 绕过 docker 重启循环，**直接看错误** |
| 5 | `docker exec -it <container> sh` | 进运行中的容器交互 |
| 6 | `cat /proc/cpuinfo` | 看 CPU 型号和支持的指令集 |
| 7 | `uname -m` | 架构（x86_64 / arm64） |

---

## 完整部署流程（最终版）

### 飞牛OS 准备（一次性）

```bash
# 1. 普通账户加 docker 组（免 sudo docker）
sudo usermod -aG docker xiaoyin
newgrp docker
docker ps    # 不加 sudo 也能跑

# 2. 拉基础镜像（用国内镜像源，绕过飞牛代理）
sudo docker pull docker.m.daocloud.io/library/node:20-alpine
sudo docker tag docker.m.daocloud.io/library/node:20-alpine node:20-alpine

sudo docker pull docker.m.daocloud.io/library/nginx:alpine
sudo docker tag docker.m.daocloud.io/library/nginx:alpine nginx:alpine
```

### 部署项目

```bash
# 1. SSH 登录
ssh xiaoyin@飞牛IP

# 2. 首次克隆（或者 git pull 更新）
cd /vol1/1000
sudo chown -R xiaoyin:xiaoyin photo-casting-demo    # 第一次 git clone 时用 root，之后给用户权限
git clone https://github.com/LingHuXuanYin/photo-casting-demo.git
cd photo-casting-demo

# 3. 切到 fnOS-release 分支
git fetch origin
git checkout -b fnOS-release origin/fnOS-release

# 4. 拉新 commit
git pull origin fnOS-release

# 5. 构建 + 启动
docker compose up -d --build

# 6. 验证
docker compose ps                                       # 两个容器都 Up (healthy)
docker compose logs --tail=50 server                    # Server listening at 3001
curl http://localhost:10001                              # web 起来
```

### 日常运维

```bash
# 看实时日志
docker compose logs -f
docker compose logs -f server    # 只看后端

# 重启（更新配置）
docker compose restart

# 停止
docker compose down

# 重新构建（更新代码后）
git pull origin fnOS-release
docker compose up -d --build

# 完全清理（删容器 + 镜像）
docker compose down --rmi all
```

---

## 调试 checklist（部署失败时按这个顺序查）

```bash
# 1. 容器起没起？
docker compose ps
# 期望: model-card-server (healthy)  +  model-card-web (healthy)
# 看到 Restarting → 容器反复崩，看 logs

# 2. server 报错信息
docker compose logs --tail=200 server
# 看 stderr 关键行：
# - "unable to determine transport target" → pino-pretty 缺失
# - "Cannot find module" → npm ci 没装上
# - "illegal instruction" → native binary CPU 不兼容
# - "Error: listen EADDRINUSE" → 端口被占
# - "Server listening" → server 起来了，去查 web 反代

# 3. server 退出码
docker inspect model-card-server --format='{{.State.ExitCode}}'
# 137 = OOM killed（deploy resources.memory 调大）
# 1 = 应用错误（看 logs）
# 132 = SIGILL (illegal instruction)

# 4. 手动启动（绕过 docker 重启循环）
docker run -it --rm --entrypoint sh model-card-server:latest
# 进去后：
node /app/dist/index.js
# 错误会原样显示

# 5. web 反代是否通
docker exec model-card-web sh -c 'wget -qO- http://model-card-server:3001/api/ping'
# 期望: {"status":"ok",...}
# 502 → web 起来了但 server 没 listen 3001

# 6. 容器内文件系统
docker exec model-card-server sh -c 'ls /app/dist /app/fonts /app/node_modules/@napi-rs'
# 检查 dist 在不在、fonts 在不在、canvas 的 native binary 在不在
```

---

## 关键 commit 列表

```
fnOS-release:
4804e01  fnOS-release: switch base image to node:20-alpine
93fb315  Fix server crash: pino-pretty is devDep, not available in production
3baafc0  Pin @napi-rs/canvas to 0.1.20 + adapt renderer for 0.1.20 sync API
b3902b6  Add env_config/ directory for centralized env management
7c4202b  web: depend on service_started instead of service_healthy
6dcce81  Relax health check start_period to absorb slow server cold start
4260332  Use npmmirror.com registry in Dockerfiles for faster China install
5bc1dd1  Fix Docker build: add per-workspace package-lock.json + unblock nginx.conf
083b9fa  Upgrade to Node 26 (Dockerfile + @types/node) + Vite 6, ES2024 target
2c277cc  Switch Docker ports to 10001 (web) / 10002 (server)
c41985f  Add Docker Compose deployment for 飞牛OS
```

---

## 复盘教训

### 1. 永远先看运行时错误，不要从 build log 推断

我一开始看 build log 觉得"build 成功，layer cached"就以为 server 正常启动。**应该第一次失败就立即看 `docker logs <container>`**——这能省下 9 次误判。

### 2. 错误信息要看完整，不要听用户转述

"不能跑"含义太多。**让用户把 docker logs 输出原样贴出来**——5 行关键日志比 5 轮猜测有效。

### 3. 不要陷入"按症状猜病因"

- unhealthy → 调 health check
- illegal instruction → 降级 native dep
- 502 → 调 nginx / 改 depends_on

这些"症状对应病因"的关联很多是错的。**真正修法**只有一个：让 server 不崩。

### 4. dev vs prod 区分要在代码里就做好

`pino-pretty` 这种 dev-only 工具，**写代码时**就要考虑 prod 环境不存在的情况。可以用：
- `process.env.NODE_ENV` 判断
- try/catch fallback
- 动态 import

不要假设"dev 装了就 prod 也有"。

### 5. 飞牛代理别用，但**飞牛 docker daemon 走国内镜像源完全 OK**

`docker.fnnas.com` 是 WebUI 封装用的镜像代理，需要账号。
**`docker.m.daocloud.io` / `docker.1ms.run` 这种通用 mirror，docker daemon 走它们完全正常**。

### 6. 用户反馈"不能跑"时要先看状态

我应该一上来就问：
- `docker ps` 输出（看状态）
- `docker logs` 输出（看真实错误）
- `docker inspect ... ExitCode`（看退出码）

而不是"按症状给方案"。

### 7. multi-step 修复要标记

这次修了 10+ 个 commit，但其实**只有 1 个**（pino-pretty）是真因。**未来应该**：先看 1 次错误，再修。**不要**：连续改 5 个地方看哪个 work。
