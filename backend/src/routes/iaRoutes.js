import { Router } from 'express'
import { createRateLimiter } from '../middlewares/rateLimitMiddleware.js'
import { requireRole } from '../middlewares/roleMiddleware.js'
import { requireBodyFields } from '../middlewares/validateMiddleware.js'
import { USUARIOS } from '../models/index.js'

const iaRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  keyPrefix: 'ia',
  message: 'Has alcanzado el límite temporal de consultas al asistente IA. Inténtalo en un minuto.',
})

export function createIaRoutes(iaController, { requireAuth }) {
  const router = Router()

  router.post(
    '/dudas',
    iaRateLimiter,
    requireAuth,
    requireRole(USUARIOS.REGISTRADO, USUARIOS.PUBLICADOR, USUARIOS.MODERADOR),
    requireBodyFields(['eventoId', 'pregunta']),
    iaController.resolverDuda
  )

  router.post(
    '/recomendaciones',
    iaRateLimiter,
    requireAuth,
    requireRole(USUARIOS.REGISTRADO, USUARIOS.PUBLICADOR, USUARIOS.MODERADOR),
    iaController.obtenerRecomendaciones
  )

  return router
}

