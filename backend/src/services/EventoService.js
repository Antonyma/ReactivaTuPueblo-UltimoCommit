import { AppError } from '../middlewares/errorHandler.js'

export class EventoService {
  constructor({ eventoRepository, negocioRepository }) {
    this.eventoRepository = eventoRepository
    this.negocioRepository = negocioRepository
  }

  async listarEventos(filters = {}) {
    return this.eventoRepository.findAll(filters)
  }

  async obtenerMapaEventos(filters = {}) {
    const eventos = await this.eventoRepository.findAll(filters)
    return eventos.map((evento) => ({
      id: evento.id,
      nombre: evento.nombre,
      coordenadas: evento.coordenadas,
      tipoEvento: evento.tipoEvento,
      dePago: evento.dePago,
      fechaInicio: evento.fechaInicio,
      fechaFin: evento.fechaFin,
      negocio: evento.negocio?.nombre || null,
    }))
  }

  async obtenerEventoPorId(eventoId) {
    const evento = await this.eventoRepository.findById(eventoId)
    if (!evento) {
      throw AppError.notFound('Evento no encontrado')
    }
    return evento
  }

  async crearEvento(data, propietarioId) {
    const negocio = await this.negocioRepository.findById(data.negocioId)
    if (!negocio) {
      throw AppError.notFound('Negocio asociado no encontrado')
    }

    if (negocio.propietario?.id !== Number(propietarioId)) {
      throw AppError.forbidden('No puedes crear eventos para un negocio que no es tuyo')
    }

    if (new Date(data.fechaFin) <= new Date(data.fechaInicio)) {
      throw AppError.badRequest('fechaFin debe ser posterior a fechaInicio')
    }

    return this.eventoRepository.create({
      ...data,
      negocio,
      coordenadas: data.coordenadas || negocio.coordenadas,
    })
  }

  async actualizarEvento(eventoId, data, propietarioId) {
    const evento = await this.obtenerEventoPorId(eventoId)
    if (evento.negocio?.propietario?.id !== Number(propietarioId)) {
      throw AppError.forbidden('Solo el publicador propietario puede modificar este evento')
    }

    if (data.fechaInicio && data.fechaFin && new Date(data.fechaFin) <= new Date(data.fechaInicio)) {
      throw AppError.badRequest('fechaFin debe ser posterior a fechaInicio')
    }

    return this.eventoRepository.update(eventoId, data)
  }

  async eliminarEvento(eventoId, propietarioId) {
    const evento = await this.obtenerEventoPorId(eventoId)
    if (evento.negocio?.propietario?.id !== Number(propietarioId)) {
      throw AppError.forbidden('Solo el publicador propietario puede eliminar este evento')
    }

    await this.eventoRepository.delete(eventoId)
    return { deleted: true, eventoId: Number(eventoId) }
  }

  async inscribirse(eventoId, usuarioId) {
    const evento = await this.obtenerEventoPorId(eventoId)

    const yaInscrito = await this.eventoRepository.isUsuarioInscrito(eventoId, usuarioId)
    if (yaInscrito) {
      throw AppError.conflict('El usuario ya está inscrito en este evento')
    }

    if (evento.asistentes >= evento.aforo) {
      throw AppError.conflict('El evento ha alcanzado el aforo máximo')
    }

    const inscripcion = await this.eventoRepository.inscribirUsuario(eventoId, usuarioId)
    return {
      eventoId: evento.id,
      nombreEvento: evento.nombre,
      asistentesActuales: evento.asistentes,
      aforo: evento.aforo,
      inscripcion,
    }
  }

  async obtenerInscritos(eventoId, propietarioId) {
    const evento = await this.obtenerEventoPorId(eventoId)
    if (evento.negocio?.propietario?.id !== Number(propietarioId)) {
      throw AppError.forbidden('Solo el publicador propietario puede consultar los inscritos')
    }

    const inscritos = await this.eventoRepository.findInscritos(eventoId)
    return {
      eventoId: evento.id,
      nombreEvento: evento.nombre,
      asistentes: evento.asistentes,
      aforo: evento.aforo,
      inscritos,
    }
  }

  async compartirEvento(eventoId) {
    const evento = await this.obtenerEventoPorId(eventoId)
    const urlPublica = `https://reactivatuPueblo.es/eventos/${evento.id}`
    const textoCompartir = `¡Apúntate a "${evento.nombre}" organizado por ${evento.negocio?.nombre}! ${urlPublica}`

    return {
      eventoId: evento.id,
      urlPublica,
      textoCompartir,
      enlaces: {
        whatsapp: `https://wa.me/?text=${encodeURIComponent(textoCompartir)}`,
        twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(textoCompartir)}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(urlPublica)}`,
      },
    }
  }
}

