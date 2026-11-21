export class WhatsappController {
  constructor({ whatsappService }) {
    this.whatsappService = whatsappService
  }

  webhook = async (req, res) => {
    const result = await this.whatsappService.procesarWebhook(req.body)
    res.status(200).json({
      ok: true,
      data: result,
    })
  }
}

