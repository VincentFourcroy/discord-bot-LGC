const WEBHOOK_AUTH_TOKEN = process.env.WEBHOOK_AUTH_TOKEN

// Middleware to verify webhook token
function verifyWebhookToken(req, res, next) {
  const token = req.headers['authorization']

  if (!token) {
    return res.status(401).send({ error: 'Missing authorization token' })
  }

  // Support both "Bearer TOKEN" and "TOKEN" formats
  const providedToken = token.startsWith('Bearer ') ? token.slice(7) : token

  if (providedToken !== WEBHOOK_AUTH_TOKEN) {
    return res.status(403).send({ error: 'Invalid authorization token' })
  }

  next()
}

module.exports = verifyWebhookToken
