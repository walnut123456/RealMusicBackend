# RealMusicBackend

仿网易云音乐后端网关（Pulse Music API Gateway）。

This folder runs the maintained `@neteasecloudmusicapienhanced/api` package as a local HTTP service.

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

On this Windows machine, inbound traffic from the emulator virtual network is blocked by the firewall. The non-invasive development setup is:

```powershell
D:\AndroidSDK\platform-tools\adb.exe reverse tcp:3000 tcp:3000
```

Then set the Debug app's API address to `http://127.0.0.1:3000`. The reverse mapping must be recreated after the emulator restarts. Alternatively, allow inbound TCP 3000 and keep the standard emulator address `http://10.0.2.2:3000`.

To use a physical phone without USB, connect the phone and computer to the same trusted Wi-Fi network. The server already binds to `0.0.0.0`; run `ipconfig` on the computer and find the Wi-Fi adapter's IPv4 address. First open `http://<computer-wifi-ip>:3000/` in the phone's browser. Once it responds, enter that same URL under **Settings → Data Service** in the Debug app and tap **Save and Test**. Do not use `127.0.0.1` or the emulator-only `10.0.2.2` for this direct LAN connection. The computer and backend must stay on, and its Wi-Fi address may change later.

If the phone's browser cannot reach the URL, check that the devices are on the same non-guest network and that the router does not isolate Wi-Fi clients. If Windows Firewall blocks the connection, allow inbound TCP 3000 only on a trusted Private network and preferably only from the local subnet. Do not expose this unauthenticated compatibility gateway to the public internet. The current Release build blocks plain HTTP, so this LAN workflow uses the Debug build.

The Android client calls `/personalized/newsong`, `/personalized`, `/top/playlist`,
`/playlist/track/all`, `/toplist`, `/cloudsearch`, `/song/url`, and `/lyric`.
This is an unofficial compatibility gateway. Do not expose it publicly with account cookies or treat it as an authorized commercial music source.
