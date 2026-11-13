'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

// The upstream package reads this file while loading its server module, but only
// creates it when its own CLI entry point is used. Our embedded entry point must
// initialize it first. Append mode preserves any existing token.
const anonymousTokenPath = path.join(os.tmpdir(), 'anonymous_token')
fs.closeSync(fs.openSync(anonymousTokenPath, 'a'))

const { serveNcmApi, getModulesDefinitions } = require('@neteasecloudmusicapienhanced/api/server')
const checkQrLogin = require('./qr-check')
const { attachRealMusicApi } = require('./realmusic-api')

async function main() {
  const port = Number(process.env.PORT || 3000)
  const host = process.env.HOST || '0.0.0.0'
  const apiRoot = path.dirname(require.resolve('@neteasecloudmusicapienhanced/api/server'))
  const moduleDefs = await getModulesDefinitions(path.join(apiRoot, 'module'), {
    'daily_signin.js': '/daily_signin',
    'fm_trash.js': '/fm_trash',
    'personal_fm.js': '/personal_fm',
  })
  const qrModule = moduleDefs.find((item) => item.identifier === 'login_qr_check')
  if (!qrModule) throw new Error('QR login check module is missing')
  qrModule.module = checkQrLogin
  const app = await serveNcmApi({ port, host, checkVersion: false, moduleDefs })
  const realMusic = attachRealMusicApi(app)
  realMusic.ready.catch((error) => console.error('[Real Music API] Database initialization failed:', error.message))

  const shutdown = (signal) => {
    console.log(`[Pulse API] ${signal} received, shutting down`)
    app.server?.close(async () => { await realMusic.close(); process.exit(0) })
  }

  process.once('SIGINT', () => shutdown('SIGINT'))
  process.once('SIGTERM', () => shutdown('SIGTERM'))
}

main().catch((error) => {
  console.error('[Pulse API] Failed to start', error)
  process.exit(1)
})
