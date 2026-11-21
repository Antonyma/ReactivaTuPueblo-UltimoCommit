export class IaController {
  constructor({ iaService }) {
    this.iaService = iaService
  }

  resolverDuda = async (req, res) => {
    const eventoId = req.params.id || req.body.eventoId
    const { pregunta } = req.body
    const usuarioId = req.user?.id || null

    const result = await this.iaService.resolverDudaEvento(eventoId, pregunta, usuarioId)
    res.status(200).json({
      ok: true,
      data: result,
    })
  }

  obtenerRecomendaciones = async (req, res) => {
    const usuarioId = req.user?.id || req.query.usuarioId || req.body?.usuarioId || null
    const preferencias = req.method === 'GET' ? req.query : req.body || {}

    const result = await this.iaService.obtenerRecomendaciones(usuarioId, preferencias)
    res.status(200).json({
      ok: true,
      data: result,
    })
  }
}

