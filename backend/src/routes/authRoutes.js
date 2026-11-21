import { Router } from 'express'
import { requireBodyFields } from '../middlewares/validateMiddleware.js'

export function createAuthRoutes(authController) {
  const router = Router()

  router.post(
    '/register',
    requireBodyFields(['nombre', 'email', 'telefono', 'password']),
    authController.register
  )
  router.post('/login', requireBodyFields(['nombre', 'password']), authController.login)

  return router
}

