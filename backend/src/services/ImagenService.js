import { AppError } from '../middlewares/errorHandler.js'

export class ImagenService {
  constructor({ imagenRepository, eventoRepository }) {
    this.imagenRepository = imagenRepository
    this.eventoRepository = eventoRepository
  }

  async listarPorEvento(eventoId) {
    const evento = await this.eventoRepository.findById(eventoId)
    if (!evento) {
      throw AppError.notFound('Evento no encontrado')
    }

    const imagenes = await this.imagenRepository.findByEventoId(eventoId)
    return {
      eventoId: evento.id,
      total: imagenes.length,
      imagenes,
    }
  }

  async subirImagen(eventoId, usuarioId, { imagen }) {
    const evento = await this.eventoRepository.findById(eventoId)
    if (!evento) {
      throw AppError.notFound('Evento no encontrado')
    }

    const url = String(imagen ?? '').trim()
    if (!url) {
      throw AppError.badRequest('El campo imagen (URL) es obligatorio')
    }

    const esPropietario = evento.negocio?.propietario?.id === Number(usuarioId)
    const estaInscrito = esPropietario
      ? true
      : await this.eventoRepository.isUsuarioInscrito(eventoId, usuarioId)

    if (!estaInscrito) {
      throw AppError.forbidden(
        'Solo los usuarios inscritos en el evento o su publicador pueden subir imágenes'
      )
    }

    return this.imagenRepository.create({
      imagen: url,
      publicadorId: usuarioId,
      eventoId: evento.id,
      evento,
    })
  }

  async eliminarImagen(eventoId, imagenId, usuarioId) {
    const evento = await this.eventoRepository.findById(eventoId)
    if (!evento) {
      throw AppError.notFound('Evento no encontrado')
    }

    if (evento.negocio?.propietario?.id !== Number(usuarioId)) {
      throw AppError.forbidden('Solo el publicador propietario del evento puede eliminar imágenes')
    }

    const imagen = await this.imagenRepository.findById(imagenId)
    if (!imagen || imagen.evento?.id !== evento.id) {
      throw AppError.notFound('Imagen no encontrada para este evento')
    }

    await this.imagenRepository.delete(imagenId)
    return { deleted: true, imagenId: Number(imagenId) }
  }
}

