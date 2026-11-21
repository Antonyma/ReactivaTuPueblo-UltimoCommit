export class ValoracionController {
  constructor({ valoracionService }) {
    this.valoracionService = valoracionService
  }

  listarPorEvento = async (req, res) => {
    const result = await this.valoracionService.listarPorEvento(req.params.id)
    res.status(200).json({
      ok: true,
      data: result,
    })
  }

  crear = async (req, res) => {
    const valoracion = await this.valoracionService.crearValoracion(
      req.params.id,
      req.user.id,
      req.body
    )
    res.status(201).json({
      ok: true,
      message: 'Valoración registrada correctamente',
      data: valoracion,
    })
  }

  eliminar = async (req, res) => {
    const result = await this.valoracionService.eliminarValoracion(
      req.params.id,
      req.params.valoracionId,
      req.user
    )
    res.status(200).json({
      ok: true,
      message: 'Valoración eliminada correctamente',
      data: result,
    })
  }
}

