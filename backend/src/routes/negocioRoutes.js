import { Router } from 'express'
import { requireRole } from '../middlewares/roleMiddleware.js'
import { validateIntParam } from '../middlewares/validateMiddleware.js'
import { USUARIOS } from '../models/index.js'

export function createNegocioRoutes(negocioController, { requireAuth }) {
  const router = Router()

  router.put(
    '/:id/redes',
    requireAuth,
    requireRole(USUARIOS.PUBLICADOR),
    validateIntParam('id'),
    negocioController.actualizarRedes
  )

  return router
}

