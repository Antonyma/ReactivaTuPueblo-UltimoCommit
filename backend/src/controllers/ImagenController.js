export class ImagenController {
  constructor({ imagenService }) {
    this.imagenService = imagenService
  }

  listarPorEvento = async (req, res) => {
    const result = await this.imagenService.listarPorEvento(req.params.id)
    res.status(200).json({
      ok: true,
      data: result,
    })
  }

  crear = async (req, res) => {
    const resultado = await this.imagenService.subirImagen(req.params.id, req.user.id, req.body)
    const total = Array.isArray(resultado) ? resultado.length : 1
    res.status(201).json({
      ok: true,
      message: total > 1 ? `${total} imágenes añadidas correctamente` : 'Imagen añadida correctamente',
      data: resultado,
    })
  }

  eliminar = async (req, res) => {
    const result = await this.imagenService.eliminarImagen(
      req.params.id,
      req.params.imagenId,
      req.user.id
    )
    res.status(200).json({
      ok: true,
      message: 'Imagen eliminada correctamente',
      data: result,
    })
  }
}

