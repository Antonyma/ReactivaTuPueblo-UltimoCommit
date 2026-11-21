import { Router } from 'express'
import { requireRole } from '../middlewares/roleMiddleware.js'
import { requireBodyFields } from '../middlewares/validateMiddleware.js'
import { USUARIOS } from '../models/index.js'

export function createIaRoutes(iaController, { requireAuth }) {
  const router = Router()

  router.post(
    '/dudas',
    requireAuth,
    requireRole(USUARIOS.REGISTRADO, USUARIOS.PUBLICADOR),
    requireBodyFields(['eventoId', 'pregunta']),
    iaController.resolverDuda
  )

  router.post(
    '/recomendaciones',
    requireAuth,
    requireRole(USUARIOS.REGISTRADO, USUARIOS.PUBLICADOR),
    iaController.obtenerRecomendaciones
  )

  return router
}

