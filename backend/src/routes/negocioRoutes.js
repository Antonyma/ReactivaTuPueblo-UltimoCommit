import { Router } from 'express'
import { requireRole } from '../middlewares/roleMiddleware.js'
import { requireBodyFields, validateIntParam } from '../middlewares/validateMiddleware.js'
import { USUARIOS } from '../models/index.js'

export function createNegocioRoutes(negocioController, { requireAuth }) {
  const router = Router()

  // Rutas públicas
  router.get('/', negocioController.listar)
  router.get('/:id', validateIntParam('id'), negocioController.obtenerPorId)

  // Rutas de publicador (CRUD completo y redes sociales)
  router.post(
    '/',
    requireAuth,
    requireRole(USUARIOS.PUBLICADOR),
    requireBodyFields(['nombre']),
    negocioController.crear
  )
  router.put(
    '/:id',
    requireAuth,
    requireRole(USUARIOS.PUBLICADOR),
    validateIntParam('id'),
    negocioController.actualizar
  )
  router.delete(
    '/:id',
    requireAuth,
    requireRole(USUARIOS.PUBLICADOR),
    validateIntParam('id'),
    negocioController.eliminar
  )
  router.put(
    '/:id/redes',
    requireAuth,
    requireRole(USUARIOS.PUBLICADOR),
    validateIntParam('id'),
    negocioController.actualizarRedes
  )

  return router
}
