export class NegocioController {
  constructor({ negocioService }) {
    this.negocioService = negocioService
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

