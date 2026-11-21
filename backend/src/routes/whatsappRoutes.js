import { Router } from 'express'
import { requireBodyFields } from '../middlewares/validateMiddleware.js'

export function createWhatsappRoutes(whatsappController) {
  const router = Router()

  router.post(
    '/webhook',
    requireBodyFields(['telefono', 'accion']),
    whatsappController.webhook
  )

  return router
}

