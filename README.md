# RealMusicBackend

仿网易云音乐后端网关（Pulse Music API Gateway）。

This folder runs the `@neteasecloudmusicapienhanced/api` gateway and Real Music's own account API.

## Real Music cloud accounts

Provision a persistent PostgreSQL database, then set its connection string as the backend's `DATABASE_URL` environment variable. Use the database provider's internal URL when the database and this Node service share a private network. Never put the connection string in Git or in the Android app. Tables are created automatically on first startup. The database stores users, salted scrypt password hashes, hashed 30-day session tokens, Bilibili/NetEase favorites, and private Real Music playlists. Each playlist can hold tracks from either source. The Android app keeps an encrypted token and a per-user SQLite favorites cache.

For durable data, do not use Render's Free Postgres plan: its database expires 30 days after creation. Use a persistent PostgreSQL plan/provider and back it up.

For local PowerShell development, set the variable in the same terminal before starting the service:

```powershell
$env:DATABASE_URL = 'postgresql://USER:PASSWORD@HOST:5432/DATABASE'
pnpm start
```

The hosted service needs the same environment variable in its service settings, followed by a new deploy. Check `GET /realmusic/v1/health`; it returns `{"ok":true,"database":"connected"}` when ready. Without `DATABASE_URL`, music gateway routes still work but Real Music account routes return HTTP 503. Never expose registration or bearer tokens over plain HTTP on a public network. The production app should point to the service's HTTPS URL.

Real Music routes are under `/realmusic/v1/`: `register`, `login`, `me`, `favorites/list`, `favorites/set`, `playlists/list`, `playlists/create`, `playlists/rename`, `playlists/delete`, `playlists/tracks`, `playlists/set-track`, and `logout`. They use POST JSON; authenticated routes require `Authorization: Bearer <token>`. Passwords and tokens are never placed in URLs. Playlist operations always check the signed-in user; they do not call the NetEase playlist API. Existing device-local favorites are imported when the currently active legacy account logs into a cloud account with the same username. Local data stays intact until every import request succeeds.

- Runtime: Node.js 22+ (currently tested with Node.js 24)
- Framework: Express-based NeteaseCloudMusicApi-compatible service
- Protocol work: NetEase weapi/eapi/linuxapi request adaptation
- Package manager: pnpm
- Port: `3000`
- Android emulator base URL: `http://10.0.2.2:3000`
- Host base URL: `http://127.0.0.1:3000`

Install and run in the foreground:

```powershell
pnpm install --frozen-lockfile
$env:PORT = "3000"
pnpm start
```

Or run it in the background from PowerShell:

```powershell
.\start.ps1
.\stop.ps1
```

For one-phone login, first try Real Music's **Login → Official Web Login** on the phone; that page signs in directly at `music.163.com` and the app validates the resulting session through this gateway. If QR authorization is needed, connect the physical phone with USB debugging enabled and run `./connect-phone.ps1` from this folder. It starts the local gateway if necessary and maps phone port 3000 to the computer. In Real Music, set **Settings → Data Service** to `http://127.0.0.1:3000`, then use **Login → Authorize in NetEase Music**. After login, the saved session can be tried with the Render gateway by changing the Data Service URL back; whether NetEase accepts that session across gateway IPs must be verified on the phone.

The upstream package's QR check handler masks request failures as a generic HTTP 404 due to a catch-block bug. This gateway replaces that one handler, returning HTTP 502 with the upstream status/code when the provider is unavailable. Local QR polling has been verified to return code 801; Render polling still requires a fresh deployment and phone authorization test.

On this Windows machine, inbound traffic from the emulator virtual network is blocked by the firewall. The non-invasive development setup is:

```powershell
D:\AndroidSDK\platform-tools\adb.exe reverse tcp:3000 tcp:3000
```

Then set the Debug app's API address to `http://127.0.0.1:3000`. The reverse mapping must be recreated after the emulator restarts. Alternatively, allow inbound TCP 3000 and keep the standard emulator address `http://10.0.2.2:3000`.

To use a physical phone without USB, connect the phone and computer to the same trusted Wi-Fi network. The server already binds to `0.0.0.0`; run `ipconfig` on the computer and find the Wi-Fi adapter's IPv4 address. First open `http://<computer-wifi-ip>:3000/` in the phone's browser. Once it responds, enter that same URL under **Settings → Data Service** in the Debug app and tap **Save and Test**. Do not use `127.0.0.1` or the emulator-only `10.0.2.2` for this direct LAN connection. The computer and backend must stay on, and its Wi-Fi address may change later.

If the phone's browser cannot reach the URL, check that the devices are on the same non-guest network and that the router does not isolate Wi-Fi clients. If Windows Firewall blocks the connection, allow inbound TCP 3000 only on a trusted Private network and preferably only from the local subnet. Do not expose this unauthenticated compatibility gateway to the public internet. The current Release build blocks plain HTTP, so this LAN workflow uses the Debug build.

The Android client uses `/personalized/newsong`, `/cloudsearch`, `/song/url`, and `/lyric` for NetEase songs. Personal playlists use only the Real Music routes above.
This is an unofficial compatibility gateway. Do not expose it publicly with account cookies or treat it as an authorized commercial music source.
