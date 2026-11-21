import { Router } from 'express'
import { requireRole } from '../middlewares/roleMiddleware.js'
import { requireBodyFields } from '../middlewares/validateMiddleware.js'
import { USUARIOS } from '../models/index.js'

export function createAuthRoutes(authController, { requireAuth }) {
  const router = Router()

  router.post(
    '/register',
    requireBodyFields(['nombre', 'email', 'telefono', 'password']),
    authController.register
  )
  router.post('/login', requireBodyFields(['nombre', 'password']), authController.login)
  router.post('/admin/login', requireBodyFields(['nombre', 'password']), authController.loginAdmin)
  router.post(
    '/admin/register',
    requireAuth,
    requireRole(USUARIOS.MODERADOR),
    requireBodyFields(['nombre', 'password']),
    authController.registerAdmin
  )
  router.get('/me', requireAuth, authController.me)

  return router
}

