import { env } from '../config/env.js'
import { AppError } from '../middlewares/errorHandler.js'

export class WhatsappController {
  constructor({ whatsappService }) {
    this.whatsappService = whatsappService
  }

  webhook = async (req, res) => {
    if (env.whatsapp.verifyToken) {
      const provided =
        req.headers['x-whatsapp-token'] ||
        req.query?.verify_token ||
        req.body?.verifyToken ||
        ''
      if (String(provided) !== env.whatsapp.verifyToken) {
        throw AppError.unauthorized('Token de verificación de webhook de WhatsApp inválido')
      }
    }

    const result = await this.whatsappService.procesarWebhook(req.body)
    res.status(200).json({
      ok: true,
      data: result,
    })
  }
}

