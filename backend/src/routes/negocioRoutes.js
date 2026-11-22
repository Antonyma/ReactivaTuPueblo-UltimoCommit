import { Router } from 'express'
import { env } from '../config/env.js'
import { AppError } from '../middlewares/errorHandler.js'
import { requireRole } from '../middlewares/roleMiddleware.js'
import { requireBodyFields, validateIntParam } from '../middlewares/validateMiddleware.js'
import { USUARIOS } from '../models/index.js'

export function createNegocioRoutes(negocioController, { requireAuth, optionalAuth }) {
  const router = Router()

  const requireCronOrModerador = (req, res, next) => {
    const apiKeyHeader = String(req.headers['x-api-key'] || '').trim()
    const validKey = env.aiAgentsApiKey || env.whatsapp.verifyToken
    if (validKey && apiKeyHeader && apiKeyHeader === validKey) {
      return next()
    }
    if (req.user?.tipoUsuario === USUARIOS.MODERADOR) {
      return next()
    }
    return next(AppError.unauthorized('Se requiere X-API-Key válida o sesión de moderador'))
  }

  // Rutas públicas
  router.get('/', negocioController.listar)
  router.post(
    '/escanear-redes',
    optionalAuth,
    requireCronOrModerador,
    negocioController.escanearTodasLasRedes
  )
  router.get('/:id', validateIntParam('id'), negocioController.obtenerPorId)
  router.get('/:id/valoraciones', validateIntParam('id'), negocioController.listarValoraciones)

  // Escaneo bajo demanda de redes sociales de un negocio (propietario o moderador)
  router.post(
    '/:id/escanear-redes',
    requireAuth,
    requireRole(USUARIOS.PUBLICADOR, USUARIOS.MODERADOR),
    validateIntParam('id'),
    negocioController.escanearRedes
  )

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

  // Rutas de moderador (confirmar / denegar comercios)
  router.patch(
    '/:id/aprobar',
    requireAuth,
    requireRole(USUARIOS.MODERADOR),
    validateIntParam('id'),
    negocioController.aprobar
  )
  router.patch(
    '/:id/denegar',
    requireAuth,
    requireRole(USUARIOS.MODERADOR),
    validateIntParam('id'),
    negocioController.denegar
  )

  return router
}
