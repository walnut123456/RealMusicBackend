'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

// The upstream package reads this file while loading its server module, but only
// creates it when its own CLI entry point is used. Our embedded entry point must
// initialize it first. Append mode preserves any existing token.
const anonymousTokenPath = path.join(os.tmpdir(), 'anonymous_token')
fs.closeSync(fs.openSync(anonymousTokenPath, 'a'))

const { serveNcmApi } = require('@neteasecloudmusicapienhanced/api/server')

async function main() {
  const port = Number(process.env.PORT || 3000)
  const host = process.env.HOST || '0.0.0.0'
  const app = await serveNcmApi({ port, host, checkVersion: false })

  const shutdown = (signal) => {
    console.log(`[Pulse API] ${signal} received, shutting down`)
    app.server?.close(() => process.exit(0))
  }

  process.once('SIGINT', () => shutdown('SIGINT'))
  process.once('SIGTERM', () => shutdown('SIGTERM'))
}

main().catch((error) => {
  console.error('[Pulse API] Failed to start', error)
  process.exit(1)
})
