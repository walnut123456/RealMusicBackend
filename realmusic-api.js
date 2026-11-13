'use strict'

const crypto = require('node:crypto')
const { promisify } = require('node:util')
const { Pool } = require('pg')

const scrypt = promisify(crypto.scrypt)
const SESSION_MS = 30 * 24 * 60 * 60 * 1000
const failures = new Map()

function attachRealMusicApi(app) {
  const connectionString = process.env.DATABASE_URL
  const pool = connectionString ? new Pool({ connectionString, max: 5 }) : null
  const ready = pool ? initialize(pool) : Promise.resolve(false)
  app.get('/realmusic/v1/health', async (_req, res) => {
    res.set('Cache-Control', 'no-store')
    if (!pool) return res.status(503).json({ ok: false, database: 'not configured' })
    try { await ready; await pool.query('SELECT 1'); res.json({ ok: true, database: 'connected' }) }
    catch (_error) { res.status(503).json({ ok: false, database: 'unavailable' }) }
  })
  const route = (path, handler) => app.post(`/realmusic/v1/${path}`, async (req, res) => {
    res.set('Cache-Control', 'no-store')
    try {
      if (!pool) return res.status(503).json({ error: 'Real Music database is not configured' })
      await ready
      if (Buffer.byteLength(JSON.stringify(req.body || {})) > 16_384) return res.status(413).json({ error: '请求内容过大' })
      await handler(req, res, pool)
    } catch (error) {
      console.error('[Real Music API]', error.code || error.message)
      res.status(500).json({ error: '服务暂时不可用' })
    }
  })

  route('register', async (req, res, db) => {
    if (limited(req)) return res.status(429).json({ error: '尝试过于频繁，请稍后重试' })
    const username = String(req.body?.username || '').trim()
    const password = String(req.body?.password || '')
    if (username.length < 2 || username.length > 32 || password.length < 8 || password.length > 128)
      return res.status(400).json({ error: '用户名需 2–32 字，密码需 8–128 字' })
    const salt = crypto.randomBytes(16)
    const hash = await scrypt(password, salt, 64)
    let user
    try {
      const result = await db.query('INSERT INTO rm_users (username, username_key, salt, password_hash) VALUES ($1,$2,$3,$4) RETURNING id,username',
        [username, username.toLocaleLowerCase('en-US'), salt, hash])
      user = result.rows[0]
    } catch (error) {
      if (error.code === '23505') return res.status(409).json({ error: '用户名已存在，请登录' })
      throw error
    }
    res.status(201).json(await newSession(db, user))
  })

  route('login', async (req, res, db) => {
    if (limited(req)) return res.status(429).json({ error: '尝试过于频繁，请稍后重试' })
    const username = String(req.body?.username || '').trim().toLocaleLowerCase('en-US')
    const password = String(req.body?.password || '')
    if (username.length > 32 || password.length > 128) return res.status(400).json({ error: '用户名或密码错误' })
    const result = await db.query('SELECT id,username,salt,password_hash FROM rm_users WHERE username_key=$1', [username])
    const user = result.rows[0]
    const hash = await scrypt(password, user?.salt || Buffer.alloc(16), 64)
    if (!user || !crypto.timingSafeEqual(hash, user.password_hash)) return res.status(401).json({ error: '用户名或密码错误' })
    res.json(await newSession(db, user))
  })

  route('me', async (req, res, db) => {
    const user = await authenticated(req, res, db)
    if (user) res.json({ user })
  })

  route('favorites/list', async (req, res, db) => {
    const user = await authenticated(req, res, db)
    if (!user) return
    const result = await db.query('SELECT track_id,title,artist,description,duration_sec,artwork_url,accent,source_page_url FROM rm_favorites WHERE user_id=$1 ORDER BY saved_at DESC LIMIT 5000', [user.id])
    res.json({ favorites: result.rows.map(row => ({ id: row.track_id, title: row.title, artist: row.artist,
      description: row.description, durationSec: row.duration_sec, artworkUrl: row.artwork_url,
      accent: Number(row.accent), sourcePageUrl: row.source_page_url })) })
  })

  route('favorites/set', async (req, res, db) => {
    const user = await authenticated(req, res, db)
    if (!user) return
    const track = req.body?.track || {}
    const liked = req.body?.liked === true
    const id = String(track.id || '')
    if (!/^(bilibili|netease):[A-Za-z0-9:_-]{1,120}$/.test(id)) return res.status(400).json({ error: '无效的音源 ID' })
    if (liked) {
      const title = String(track.title || '').slice(0, 300)
      const artist = String(track.artist || '').slice(0, 300)
      if (!title || !artist) return res.status(400).json({ error: '歌曲信息不完整' })
      await db.query(`INSERT INTO rm_favorites (user_id,track_id,title,artist,description,duration_sec,artwork_url,accent,source_page_url)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (user_id,track_id) DO UPDATE SET
        title=EXCLUDED.title,artist=EXCLUDED.artist,description=EXCLUDED.description,duration_sec=EXCLUDED.duration_sec,
        artwork_url=EXCLUDED.artwork_url,accent=EXCLUDED.accent,source_page_url=EXCLUDED.source_page_url,saved_at=NOW()`,
      [user.id,id,title,artist,String(track.description || '').slice(0, 1000),Math.max(0,Math.min(Number(track.durationSec)||0,86400)),
        String(track.artworkUrl || '').slice(0, 2048),Number(track.accent)||0,String(track.sourcePageUrl || '').slice(0, 2048)])
    } else await db.query('DELETE FROM rm_favorites WHERE user_id=$1 AND track_id=$2', [user.id,id])
    res.json({ ok: true })
  })

  route('logout', async (req, res, db) => {
    const token = bearer(req)
    if (token) await db.query('DELETE FROM rm_sessions WHERE token_hash=$1', [digest(token)])
    res.json({ ok: true })
  })

  return { close: () => pool?.end(), ready }
}

async function initialize(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS rm_users (
    id BIGSERIAL PRIMARY KEY, username TEXT NOT NULL, username_key TEXT NOT NULL UNIQUE,
    salt BYTEA NOT NULL, password_hash BYTEA NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
  await db.query(`CREATE TABLE IF NOT EXISTS rm_sessions (
    token_hash TEXT PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES rm_users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL)`)
  await db.query(`CREATE TABLE IF NOT EXISTS rm_favorites (
    user_id BIGINT NOT NULL REFERENCES rm_users(id) ON DELETE CASCADE,
    track_id TEXT NOT NULL, title TEXT NOT NULL, artist TEXT NOT NULL, description TEXT NOT NULL,
    duration_sec INTEGER NOT NULL, artwork_url TEXT NOT NULL, accent BIGINT NOT NULL,
    source_page_url TEXT NOT NULL, saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(user_id,track_id))`)
  return true
}

async function newSession(db, user) {
  const token = crypto.randomBytes(32).toString('base64url')
  await db.query('INSERT INTO rm_sessions (token_hash,user_id,expires_at) VALUES ($1,$2,$3)',
    [digest(token),user.id,new Date(Date.now()+SESSION_MS)])
  return { token, user: { id: Number(user.id), username: user.username } }
}
function digest(token) { return crypto.createHash('sha256').update(token).digest('hex') }
function bearer(req) {
  const match = /^Bearer ([A-Za-z0-9_-]{20,100})$/.exec(req.headers.authorization || '')
  return match?.[1]
}
async function authenticated(req, res, db) {
  const token = bearer(req)
  if (!token) { res.status(401).json({ error: '请先登录 Real Music' }); return null }
  const result = await db.query(`SELECT u.id,u.username FROM rm_sessions s JOIN rm_users u ON u.id=s.user_id
    WHERE s.token_hash=$1 AND s.expires_at>NOW()`, [digest(token)])
  if (!result.rows[0]) { res.status(401).json({ error: '登录已过期，请重新登录' }); return null }
  return { id: Number(result.rows[0].id), username: result.rows[0].username }
}
function limited(req) {
  const key = req.ip || 'unknown'
  const now = Date.now()
  const item = failures.get(key)
  if (!item || now - item.started > 15*60*1000) { failures.set(key,{started:now,count:1}); return false }
  item.count++
  return item.count > 20
}

module.exports = { attachRealMusicApi }
