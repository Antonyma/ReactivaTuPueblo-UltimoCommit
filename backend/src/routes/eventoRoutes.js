import { Router } from 'express'
import { requireRole } from '../middlewares/roleMiddleware.js'
import { requireBodyFields, validateIntParam } from '../middlewares/validateMiddleware.js'
import { USUARIOS } from '../models/index.js'

export function createEventoRoutes(eventoController, iaController, { requireAuth }) {
  const router = Router()

  // Rutas públicas (calendario y mapa)
  router.get('/', eventoController.listar)
  router.get('/mapa', eventoController.mapa)
  router.get('/:id', validateIntParam('id'), eventoController.obtenerPorId)
  router.get('/:id/compartir', validateIntParam('id'), eventoController.compartir)

  // Rutas de usuario registrado (inscripción y dudas)
  router.post(
    '/:id/inscribirse',
    requireAuth,
    requireRole(USUARIOS.REGISTRADO, USUARIOS.PUBLICADOR),
    validateIntParam('id'),
    eventoController.inscribirse
  )
  router.post(
    '/:id/dudas',
    requireAuth,
    requireRole(USUARIOS.REGISTRADO, USUARIOS.PUBLICADOR),
    validateIntParam('id'),
    requireBodyFields(['pregunta']),
    iaController.resolverDuda
  )

  // Rutas de publicador (CRUD y gestión de inscritos)
  router.post(
    '/',
    requireAuth,
    requireRole(USUARIOS.PUBLICADOR),
    requireBodyFields(['nombre', 'negocioId', 'descripcion', 'aforo', 'tipoEvento', 'fechaInicio', 'fechaFin']),
    eventoController.crear
  )
  router.put(
    '/:id',
    requireAuth,
    requireRole(USUARIOS.PUBLICADOR),
    validateIntParam('id'),
    eventoController.actualizar
  )
  router.delete(
    '/:id',
    requireAuth,
    requireRole(USUARIOS.PUBLICADOR),
    validateIntParam('id'),
    eventoController.eliminar
  )
  router.get(
    '/:id/inscritos',
    requireAuth,
    requireRole(USUARIOS.PUBLICADOR),
    validateIntParam('id'),
    eventoController.verInscritos
  )

  return router
}

