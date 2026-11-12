'use strict'

const createOption = require('@neteasecloudmusicapienhanced/api/util/option.js')

// The package's login_qr_check handler references a try-scoped variable in
// catch, turning upstream failures into an unrelated 404 from its router.
module.exports = async function checkQrLogin(query, request) {
  try {
    const response = await request(
      '/api/login/qrcode/client/login',
      { key: query.key, type: 3 },
      createOption(query),
    )
    const cookies = Array.isArray(response.cookie) ? response.cookie : []
    return {
      status: response.status || 200,
      body: { ...response.body, cookie: cookies.join(';') },
      cookie: cookies,
    }
  } catch (error) {
    const upstreamStatus = Number(error?.status)
    const upstreamCode = Number(error?.body?.code)
    console.warn('[Pulse API] QR poll upstream failure', {
      status: Number.isFinite(upstreamStatus) ? upstreamStatus : null,
      code: Number.isFinite(upstreamCode) ? upstreamCode : null,
    })
    return {
      status: 502,
      body: {
        code: 502,
        msg: 'QR login status is unavailable from the upstream service',
        upstreamStatus: Number.isFinite(upstreamStatus) ? upstreamStatus : null,
        upstreamCode: Number.isFinite(upstreamCode) ? upstreamCode : null,
      },
      cookie: [],
    }
  }
}
