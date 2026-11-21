export class NegocioController {
  constructor({ negocioService }) {
    this.negocioService = negocioService
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
}
