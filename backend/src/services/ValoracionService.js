import { AppError } from '../middlewares/errorHandler.js'

export class ValoracionService {
  constructor({ valoracionRepository, eventoRepository }) {
    this.valoracionRepository = valoracionRepository
    this.eventoRepository = eventoRepository
  }

  async listarPorEvento(eventoId) {
    const evento = await this.eventoRepository.findById(eventoId)
    if (!evento) {
      throw AppError.notFound('Evento no encontrado')
    }

    const valoraciones = await this.valoracionRepository.findByEventoId(eventoId)
    const total = valoraciones.length
    const suma = valoraciones.reduce((acc, v) => acc + v.estrellas, 0)
    const mediaEstrellas = total > 0 ? Number((suma / total).toFixed(2)) : 0

    return {
      eventoId: evento.id,
      total,
      mediaEstrellas,
      valoraciones,
    }
  }

  async listarPorNegocio(negocioId) {
    const eventos = await this.eventoRepository.findAll({ negocioId: Number(negocioId) })
    const listas = await Promise.all(
      eventos.map((ev) => this.valoracionRepository.findByEventoId(ev.id))
    )
    const valoraciones = listas
      .flat()
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

    const total = valoraciones.length
    const suma = valoraciones.reduce((acc, v) => acc + v.estrellas, 0)
    const mediaEstrellas = total > 0 ? Number((suma / total).toFixed(2)) : 0

    return {
      negocioId: Number(negocioId),
      total,
      mediaEstrellas,
      valoraciones,
    }
  }

  async crearValoracion(eventoId, usuarioId, { estrellas, texto = '' }) {
    const evento = await this.eventoRepository.findById(eventoId)
    if (!evento) {
      throw AppError.notFound('Evento no encontrado')
    }

    const inscrito = await this.eventoRepository.isUsuarioInscrito(eventoId, usuarioId)
    if (!inscrito) {
      throw AppError.forbidden('Solo los usuarios inscritos en el evento pueden valorarlo')
    }

    if (evento.fechaFin) {
      const finMs = new Date(evento.fechaFin).getTime()
      if (!Number.isNaN(finMs) && finMs > Date.now()) {
        throw AppError.badRequest('Solo puedes valorar el evento cuando haya finalizado')
      }
    }

    const estrellasNum = Number(estrellas)
    if (!Number.isInteger(estrellasNum) || estrellasNum < 1 || estrellasNum > 5) {
      throw AppError.badRequest('estrellas debe ser un entero entre 1 y 5')
    }

    const existente = await this.valoracionRepository.findByUsuarioAndEvento(usuarioId, eventoId)
    if (existente) {
      throw AppError.conflict('Ya has valorado este evento')
    }

    return this.valoracionRepository.create({
      usuarioId,
      eventoId: evento.id,
      evento,
      estrellas: estrellasNum,
      texto: String(texto ?? '').trim(),
      fecha: new Date(),
    })
  }

  async eliminarValoracion(eventoId, valoracionId, usuarioId) {
    const valoracion = await this.valoracionRepository.findById(valoracionId)
    if (!valoracion || valoracion.evento?.id !== Number(eventoId)) {
      throw AppError.notFound('Valoración no encontrada para este evento')
    }

    if (valoracion.usuario?.id !== Number(usuarioId)) {
      throw AppError.forbidden('Solo puedes eliminar tus propias valoraciones')
    }

    await this.valoracionRepository.delete(valoracionId)
    return { deleted: true, valoracionId: Number(valoracionId) }
  }
}

