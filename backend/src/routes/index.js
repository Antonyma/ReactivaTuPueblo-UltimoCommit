import { Router } from 'express'
import { createRateLimiter } from '../middlewares/rateLimitMiddleware.js'
import { requireRole } from '../middlewares/roleMiddleware.js'
import { USUARIOS } from '../models/index.js'
import { createAuthRoutes } from './authRoutes.js'
import { createEventoRoutes } from './eventoRoutes.js'
import healthRoutes from './healthRoutes.js'
import { createIaRoutes } from './iaRoutes.js'
import { createMunicipioRoutes } from './municipioRoutes.js'
import { createNegocioRoutes } from './negocioRoutes.js'
import { createUsuarioRoutes } from './usuarioRoutes.js'
import { createWhatsappRoutes } from './whatsappRoutes.js'

const recomendacionesLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  keyPrefix: 'recomendaciones_ia',
  message: 'Demasiadas peticiones de recomendaciones IA. Espera un minuto.',
})

export function createApiRouter(container) {
  const router = Router()
  const { controllers, middlewares } = container

  router.use('/health', healthRoutes)
  router.use('/municipios', createMunicipioRoutes())
  router.use('/auth', createAuthRoutes(controllers.authController, middlewares))
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
    recomendacionesLimiter,
    middlewares.requireAuth,
    requireRole(USUARIOS.REGISTRADO, USUARIOS.PUBLICADOR),
    controllers.iaController.obtenerRecomendaciones
  )
  router.use('/whatsapp', createWhatsappRoutes(controllers.whatsappController))

  return router
}

