# env_config/ — 环境配置文件目录

把所有环境相关配置集中在这里，避免散落在 `docker-compose.yml`、`.env`、代码里。

## 文件加载顺序（后加载的覆盖前面的）

```
.env_default   ← 兜底（最低优先级）
.env_dev       ← 本地开发（中间）
.env_fnOS      ← 飞牛OS 生产（更高）
.env_local     ← 个人本地覆盖（最高，git 忽略）
```

## 加载方式

### Docker Compose（推荐）

`docker-compose.yml` 里用 `env_file` 引入：

```yaml
services:
  server:
    env_file:
      - env_config/.env_fnOS
  web:
    env_file:
      - env_config/.env_fnOS
```

Docker 自动把 `KEY=VALUE` 注入到容器的 `process.env`，代码里 `process.env.KEY` 直接读。

### 本地开发

用 `dotenv-cli` 或在 `package.json` 的 `dev` 脚本前加：

```bash
# PowerShell
$env:Path += ";$env:USERPROFILE\Documents\photo-design\env_config"
Get-Content env_config\.env_dev | ForEach-Object { if ($_ -match '^([^#][^=]+)=(.*)$') { Set-Item -Path "Env:\$($Matches[1])" -Value $Matches[2] } }

# 或 bash
export $(cat env_config/.env_dev | xargs)
npm run dev
```

## 常用变量

| 变量 | 默认 | 用途 |
|------|------|------|
| `NODE_ENV` | `production` | Node 模式（dev/production） |
| `PORT` | `3001` | Server 监听端口（容器内） |
| `HOST` | `0.0.0.0` | Server 绑定地址 |
| `WEB_ORIGIN` | `http://localhost:10001` | CORS 允许的 web 来源 |
| `SERVER_MEMORY_LIMIT` | `1G` | Server 容器内存上限 |
| `WEB_MEMORY_LIMIT` | `256M` | Web 容器内存上限 |

## 在代码里读

```typescript
// TypeScript / Node
const port = process.env.PORT ?? 3001;
const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
```

## 添加新平台

复制 `.env_fnOS` 为 `.env_<platform>`，然后在部署命令里覆盖：

```bash
# 例：未来加 ARM Mac mini 平台
docker compose --env-file env_config/.env_arm_mac up -d
```

或者改 `docker-compose.yml` 的 `env_file` 字段引用新文件。

## 个人本地覆盖

```bash
cp env_config/.env_local.example env_config/.env_local
# 编辑 .env_local 改你的本地值（git 已忽略）
```

`.env_local` 的优先级最高，会覆盖平台配置。
