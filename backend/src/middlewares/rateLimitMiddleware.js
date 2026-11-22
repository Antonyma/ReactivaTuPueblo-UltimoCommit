import { AppError } from './errorHandler.js'

function resolveClientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim()
  }
  return req.ip || req.socket?.remoteAddress || 'unknown'
}

/**
 * Middleware de límite de peticiones en memoria sin dependencias externas.
 * Protege endpoints sensibles (auth, IA, scraping) frente a abuso o fuerza bruta.
 */
export function createRateLimiter({
  windowMs = 60_000,
  max = 20,
  keyPrefix = 'rl',
  message = 'Demasiadas peticiones. Espera un momento antes de volver a intentarlo.',
} = {}) {
  const hits = new Map()

  const cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of hits.entries()) {
      if (entry.resetAt <= now) {
        hits.delete(key)
      }
    }
  }, Math.max(30_000, windowMs))

  if (typeof cleanupTimer.unref === 'function') {
    cleanupTimer.unref()
  }

  return function rateLimitMiddleware(req, res, next) {
    const now = Date.now()
    const ip = resolveClientIp(req)
    const key = `${keyPrefix}:${ip}`

    let entry = hits.get(key)
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs }
      hits.set(key, entry)
    }

    entry.count += 1
    const remaining = Math.max(0, max - entry.count)
    const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000))

    res.setHeader('RateLimit-Limit', String(max))
    res.setHeader('RateLimit-Remaining', String(remaining))
    res.setHeader('RateLimit-Reset', String(retryAfterSec))

    if (entry.count > max) {
      res.setHeader('Retry-After', String(retryAfterSec))
      return next(new AppError(message, 429, 'RATE_LIMIT_EXCEEDED'))
    }

    return next()
  }
}

