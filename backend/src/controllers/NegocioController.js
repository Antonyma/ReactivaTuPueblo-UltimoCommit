export class NegocioController {
  constructor({ negocioService, valoracionService, socialScraperService = null }) {
    this.negocioService = negocioService
    this.valoracionService = valoracionService
    this.socialScraperService = socialScraperService
  }

  listar = async (req, res) => {
    const negocios = await this.negocioService.listarNegocios(req.query)
    res.status(200).json({
      ok: true,
      data: negocios,
    })
  }

  obtenerPorId = async (req, res) => {
    const negocio = await this.negocioService.obtenerNegocioPorId(req.params.id)
    res.status(200).json({
      ok: true,
      data: negocio,
    })
  }

  crear = async (req, res) => {
    const negocio = await this.negocioService.crearNegocio(req.body, req.user.id)
    res.status(201).json({
      ok: true,
      message: 'Negocio creado correctamente',
      data: negocio,
    })
  }

  actualizar = async (req, res) => {
    const negocio = await this.negocioService.actualizarNegocio(
      req.params.id,
      req.body,
      req.user.id
    )
    res.status(200).json({
      ok: true,
      message: 'Negocio actualizado correctamente',
      data: negocio,
    })
  }

  eliminar = async (req, res) => {
    const result = await this.negocioService.eliminarNegocio(req.params.id, req.user.id)
    res.status(200).json({
      ok: true,
      message: 'Negocio eliminado correctamente',
      data: result,
    })
  }

  actualizarRedes = async (req, res) => {
    const { id } = req.params
    const negocio = await this.negocioService.actualizarRedesSociales(id, req.user.id, req.body)

    res.status(200).json({
      ok: true,
      message: 'Redes sociales actualizadas correctamente',
      data: negocio,
    })
  }

  listarValoraciones = async (req, res) => {
    await this.negocioService.obtenerNegocioPorId(req.params.id)
    const result = await this.valoracionService.listarPorNegocio(req.params.id)
    res.status(200).json({
      ok: true,
      data: result,
    })
  }

  aprobar = async (req, res) => {
    const negocio = await this.negocioService.aprobarNegocio(req.params.id)
    res.status(200).json({
      ok: true,
      message: 'Comercio confirmado correctamente',
      data: negocio,
    })
  }

  denegar = async (req, res) => {
    const result = await this.negocioService.denegarNegocio(req.params.id)
    res.status(200).json({
      ok: true,
      message: 'Comercio denegado y eliminado',
      data: result,
    })
  }

  escanearRedes = async (req, res) => {
    const result = await this.socialScraperService.escanearNegocio(req.params.id, {
      user: req.user,
      esSistema: false,
      opciones: req.body || {},
    })
    res.status(200).json({
      ok: true,
      message: result.mensaje,
      data: result,
    })
  }

  escanearRedesStream = async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()

    const sendEvent = (payload) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(payload)}\n\n`)
      }
    }

    try {
      const result = await this.socialScraperService.escanearNegocio(req.params.id, {
        user: req.user,
        esSistema: false,
        opciones: req.body || {},
        onProgress: ({ progress, message }) => {
          sendEvent({ type: 'progress', progress, message })
        },
      })
      sendEvent({ type: 'done', message: result.mensaje, data: result })
    } catch (err) {
      sendEvent({
        type: 'error',
        message: err?.message || 'Error al escanear las redes sociales',
      })
    } finally {
      if (!res.writableEnded) {
        res.end()
      }
    }
  }

  escanearTodasLasRedes = async (_req, res) => {
    const result = await this.socialScraperService.escanearTodosLosNegocios()
    res.status(200).json({
      ok: true,
      message: `Escaneo completado: ${result.totalEventosCreados} evento(s) nuevo(s) en ${result.negociosEvaluados} negocio(s).`,
      data: result,
    })
  }
}
