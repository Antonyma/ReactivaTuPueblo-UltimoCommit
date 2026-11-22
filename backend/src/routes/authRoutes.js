import { Router } from 'express'
import { createRateLimiter } from '../middlewares/rateLimitMiddleware.js'
import { requireRole } from '../middlewares/roleMiddleware.js'
import { requireBodyFields } from '../middlewares/validateMiddleware.js'
import { USUARIOS } from '../models/index.js'

const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  keyPrefix: 'auth',
  message: 'Demasiados intentos de acceso. Espera unos minutos antes de volver a intentarlo.',
})

export function createAuthRoutes(authController, { requireAuth }) {
  const router = Router()

  router.post(
    '/register',
    authRateLimiter,
    requireBodyFields(['nombre', 'email', 'telefono', 'password']),
    authController.register
  )
  router.post(
    '/login',
    authRateLimiter,
    requireBodyFields(['nombre', 'password']),
    authController.login
  )
  router.post(
    '/admin/login',
    authRateLimiter,
    requireBodyFields(['nombre', 'password']),
    authController.loginAdmin
  )
  router.post(
    '/admin/register',
    authRateLimiter,
    requireAuth,
    requireRole(USUARIOS.MODERADOR),
    requireBodyFields(['nombre', 'password']),
    authController.registerAdmin
  )
  router.get('/me', requireAuth, authController.me)

  return router
}

