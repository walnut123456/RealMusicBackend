# Real Music Backend

这是 Real Music 自己的 Node.js 后端，源码在本仓库。它不是 MusicFree 的“未开源后端”：MusicFree 客户端主要通过插件搜索与播放，本服务是在该客户端分支上新增的账号和云端数据服务。

## 组成

- `server.js`：启动 `@neteasecloudmusicapienhanced/api` 兼容网关，并挂载 Real Music 路由。
- `realmusic-api.js`：自己的注册、登录、会话、收藏和歌单 API，使用 PostgreSQL。
- `qr-check.js`：修正上游二维码轮询错误处理。
- `start.ps1`、`stop.ps1`：Windows 本机后台启动和停止。

数据库使用你在 Render 服务中配置的 `DATABASE_URL` 环境变量。这个值应指向你的 Neon PostgreSQL；连接串和密码不要提交到 Git。服务启动时会自动创建 `rm_users`、`rm_sessions`、`rm_favorites`、`rm_playlists` 和 `rm_playlist_tracks` 表。密码使用随机盐与 scrypt 哈希；会话令牌只存 SHA-256 哈希。

## 本机启动

需要 Node.js 22+ 与 pnpm。进入本目录后：

```powershell
pnpm install --frozen-lockfile
$env:DATABASE_URL = 'postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require'
$env:PORT = '3000'
pnpm start
```

也可以运行 `.\start.ps1` 在后台启动，`.\stop.ps1` 停止。环境变量必须在启动进程时可用。未配置数据库时，网易云兼容接口仍可启动，但 Real Music 账号接口会返回 503。

本机检查：`GET http://127.0.0.1:3000/realmusic/v1/health`。数据库可连接时返回 `{"ok":true,"database":"connected"}`。

## 云端部署

当前客户端默认访问 `https://realmusicbackend.onrender.com`。Render 构建命令为 `pnpm install --frozen-lockfile`，启动命令为 `pnpm start`，端口使用 Render 注入的 `PORT`。在 Render 环境变量中设置 `DATABASE_URL`，指向你的 Neon 数据库。推送本仓库的 `main` 分支后，若 Render 已关联该分支且开启自动部署，会部署新提交；否则需要在 Render 手动触发部署。部署后检查 `https://realmusicbackend.onrender.com/realmusic/v1/health`。

## Real Music API

所有写操作均为 POST JSON，认证接口使用 `Authorization: Bearer <token>`：

| 路径前缀 `/realmusic/v1/` | 功能 |
| --- | --- |
| `register`、`login`、`me`、`logout` | Real Music 账号与会话 |
| `favorites/list`、`favorites/set` | 网易云和 Bilibili 歌曲收藏 |
| `playlists/list`、`playlists/create`、`playlists/rename`、`playlists/delete` | 自建歌单 |
| `playlists/tracks`、`playlists/set-track` | 歌单曲目 |

新 MusicFree 客户端已接入账号和喜欢列表；普通自建歌单仍使用 MusicFree 本地存储，尚未接入上述云歌单接口。网易云搜索与播放地址由兼容网关提供，Bilibili 搜索由客户端直接请求 Bilibili。上游音源、版权与可播放性不由本服务保证。

后端是 `Project1/backend/netease-cloud-music-api` 内的**独立 Git 仓库**。`Project1` 根目录的客户端仓库忽略 `backend/`；提交和推送后端时必须在本目录执行 Git 命令。
