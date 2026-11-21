import { Router } from 'express'
import { requireRole } from '../middlewares/roleMiddleware.js'
import { USUARIOS } from '../models/index.js'
import { createAuthRoutes } from './authRoutes.js'
import { createEventoRoutes } from './eventoRoutes.js'
import healthRoutes from './healthRoutes.js'
import { createIaRoutes } from './iaRoutes.js'
import { createNegocioRoutes } from './negocioRoutes.js'
import { createUsuarioRoutes } from './usuarioRoutes.js'
import { createWhatsappRoutes } from './whatsappRoutes.js'

export function createApiRouter(container) {
  const router = Router()
  const { controllers, middlewares } = container

  router.use('/health', healthRoutes)
  router.use('/auth', createAuthRoutes(controllers.authController))
  router.use('/usuarios', createUsuarioRoutes(controllers.usuarioController, middlewares))
  router.use('/negocios', createNegocioRoutes(controllers.negocioController, middlewares))
  router.use(
    '/eventos',
    createEventoRoutes(
      controllers.eventoController,
      controllers.iaController,
      controllers.valoracionController,
      controllers.imagenController,
      middlewares
    )
  )
  router.use('/ia', createIaRoutes(controllers.iaController, middlewares))
  router.get(
    '/recomendaciones',
    middlewares.requireAuth,
    requireRole(USUARIOS.REGISTRADO, USUARIOS.PUBLICADOR),
    controllers.iaController.obtenerRecomendaciones
  )
  router.use('/whatsapp', createWhatsappRoutes(controllers.whatsappController))

  return router
}

