import { Router } from 'express'
import { requireRole } from '../middlewares/roleMiddleware.js'
import { validateIntParam } from '../middlewares/validateMiddleware.js'
import { USUARIOS } from '../models/index.js'

export function createUsuarioRoutes(usuarioController, { requireAuth }) {
  const router = Router()

  router.post(
    '/:id/solicitar-publicador',
    validateIntParam('id'),
    usuarioController.solicitarPublicador
  )

  router.get(
    '/:id/historial',
    requireAuth,
    requireRole(USUARIOS.REGISTRADO, USUARIOS.PUBLICADOR),
    validateIntParam('id'),
    usuarioController.obtenerHistorial
  )

  return router
}

