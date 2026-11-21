import { Router } from 'express'
import { requireRole } from '../middlewares/roleMiddleware.js'
import { requireBodyFields, validateIntParam } from '../middlewares/validateMiddleware.js'
import { USUARIOS } from '../models/index.js'

export function createEventoRoutes(
  eventoController,
  iaController,
  valoracionController,
  imagenController,
  { requireAuth }
) {
  const router = Router()

  // Rutas públicas (calendario y mapa)
  router.get('/', eventoController.listar)
  router.get('/mapa', eventoController.mapa)
  router.get('/:id', validateIntParam('id'), eventoController.obtenerPorId)
  router.get('/:id/compartir', validateIntParam('id'), eventoController.compartir)

  // Valoraciones de evento
  router.get('/:id/valoraciones', validateIntParam('id'), valoracionController.listarPorEvento)
  router.post(
    '/:id/valoraciones',
    requireAuth,
    requireRole(USUARIOS.REGISTRADO, USUARIOS.PUBLICADOR),
    validateIntParam('id'),
    requireBodyFields(['estrellas']),
    valoracionController.crear
  )
  router.delete(
    '/:id/valoraciones/:valoracionId',
    requireAuth,
    requireRole(USUARIOS.REGISTRADO, USUARIOS.PUBLICADOR),
    validateIntParam('id'),
    validateIntParam('valoracionId'),
    valoracionController.eliminar
  )

  // Imágenes de evento (subir: inscritos o publicador; eliminar: solo publicador propietario)
  router.get('/:id/imagenes', validateIntParam('id'), imagenController.listarPorEvento)
  router.post(
    '/:id/imagenes',
    requireAuth,
    requireRole(USUARIOS.REGISTRADO, USUARIOS.PUBLICADOR),
    validateIntParam('id'),
    requireBodyFields(['imagen']),
    imagenController.crear
  )
  router.delete(
    '/:id/imagenes/:imagenId',
    requireAuth,
    requireRole(USUARIOS.PUBLICADOR),
    validateIntParam('id'),
    validateIntParam('imagenId'),
    imagenController.eliminar
  )

  // Rutas de usuario registrado (inscripción y dudas)
  router.post(
    '/:id/inscribirse',
    requireAuth,
    requireRole(USUARIOS.REGISTRADO, USUARIOS.PUBLICADOR, USUARIOS.MODERADOR),
    validateIntParam('id'),
    eventoController.inscribirse
  )
  router.delete(
    '/:id/inscribirse',
    requireAuth,
    requireRole(USUARIOS.REGISTRADO, USUARIOS.PUBLICADOR, USUARIOS.MODERADOR),
    validateIntParam('id'),
    eventoController.desapuntarse
  )
  router.post(
    '/:id/dudas',
    requireAuth,
    requireRole(USUARIOS.REGISTRADO, USUARIOS.PUBLICADOR, USUARIOS.MODERADOR),
    validateIntParam('id'),
    requireBodyFields(['pregunta']),
    iaController.resolverDuda
  )

  // Rutas de moderador (aprobar / denegar)
  router.post(
    '/:id/aprobar',
    requireAuth,
    requireRole(USUARIOS.MODERADOR),
    validateIntParam('id'),
    eventoController.aprobar
  )
  router.post(
    '/:id/denegar',
    requireAuth,
    requireRole(USUARIOS.MODERADOR),
    validateIntParam('id'),
    eventoController.denegar
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
