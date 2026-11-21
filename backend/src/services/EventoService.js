import { AppError } from '../middlewares/errorHandler.js'
import { env } from '../config/env.js'

const TIPO_EVENTO_CATEGORIA = {
  1: 'Turismo',
  2: 'Fiesta Patronal',
  3: 'Gastronomía',
  4: 'Comercio',
  5: 'Deportes',
  6: 'Cultura',
}

async function moderarEventoConIa(data) {
  try {
    const res = await fetch(`${env.aiAgentsUrl}/agents/moderate/autonomous`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({
        evento: {
          titulo: data.nombre,
          nombre: data.nombre,
          descripcion: data.descripcion || '',
          categoria: TIPO_EVENTO_CATEGORIA[Number(data.tipoEvento)] || 'Turismo',
          imagen: data.imagen || '',
        },
      }),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export class EventoService {
  constructor({ eventoRepository, negocioRepository, valoracionRepository = null }) {
    this.eventoRepository = eventoRepository
    this.negocioRepository = negocioRepository
    this.valoracionRepository = valoracionRepository
  }

  async listarEventos(filters = {}) {
    const [eventos, valoraciones] = await Promise.all([
      this.eventoRepository.findAll(filters),
      this.valoracionRepository ? this.valoracionRepository.findAll().catch(() => []) : Promise.resolve([]),
    ])

    const statsPorEvento = new Map()
    for (const v of valoraciones || []) {
      const evId = Number(v.evento?.id ?? v.eventoId)
      if (!evId) continue
      const prev = statsPorEvento.get(evId) || { suma: 0, total: 0 }
      prev.suma += Number(v.estrellas || 0)
      prev.total += 1
      statsPorEvento.set(evId, prev)
    }

    return eventos.map((ev) => {
      const st = statsPorEvento.get(Number(ev.id))
      return {
        ...ev,
        totalValoraciones: st ? st.total : 0,
        mediaEstrellas: st && st.total > 0 ? Number((st.suma / st.total).toFixed(1)) : null,
      }
    })
  }

  async obtenerMapaEventos(filters = {}) {
    const eventos = await this.eventoRepository.findAll(filters)
    return eventos.map((evento) => ({
      id: evento.id,
      nombre: evento.nombre,
      pueblo: evento.pueblo,
      coordenadas: evento.coordenadas,
      tipoEvento: evento.tipoEvento,
      dePago: evento.dePago,
      fechaInicio: evento.fechaInicio,
      fechaFin: evento.fechaFin,
      estado: evento.estado,
      motivo: evento.motivo,
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
    const { creadoOffline, ...eventoData } = data
    const esCreadoOffline = Boolean(creadoOffline)

    const negocio = await this.negocioRepository.findById(eventoData.negocioId)
    if (!negocio) {
      throw AppError.notFound('Negocio asociado no encontrado')
    }

    if (negocio.propietario?.id !== Number(propietarioId)) {
      throw AppError.forbidden('No puedes crear eventos para un negocio que no es tuyo')
    }

    if (Number(negocio.fiabilidad ?? 0) <= 0) {
      throw AppError.forbidden('Este comercio está pendiente de confirmación por un moderador')
    }

    if (new Date(eventoData.fechaFin) <= new Date(eventoData.fechaInicio)) {
      throw AppError.badRequest('fechaFin debe ser posterior a fechaInicio')
    }

    let estadoInicial
    let motivoInicial

    if (esCreadoOffline) {
      estadoInicial = 'pendiente'
      motivoInicial = 'Creada sin conexión · Pendiente de revisión por Moderador'
    } else {
      const esDeConfianza = Number(negocio.fiabilidad ?? 0) >= 60
      estadoInicial = eventoData.estado || (esDeConfianza ? 'aprobada' : 'pendiente')
      motivoInicial =
        eventoData.motivo ||
        (esDeConfianza
          ? 'Pase directo por fiabilidad del negocio'
          : 'Pendiente de revisión por Moderador')

      if (!eventoData.estado) {
        const resultadoIa = await moderarEventoConIa(eventoData)
        if (resultadoIa && typeof resultadoIa.aprobada === 'boolean') {
          estadoInicial = resultadoIa.aprobada ? 'aprobada' : 'denegada'
          motivoInicial =
            resultadoIa.motivo ||
            (resultadoIa.aprobada
              ? 'Aprobada por Moderador IA'
              : 'Rechazada por Moderador IA')
        }
      }
    }

    return this.eventoRepository.create({
      ...eventoData,
      negocio,
      pueblo: eventoData.pueblo || negocio.pueblo || '',
      coordenadas: eventoData.coordenadas || negocio.coordenadas,
      estado: estadoInicial,
      motivo: motivoInicial,
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

  async terminarEvento(eventoId, propietarioId) {
    const evento = await this.obtenerEventoPorId(eventoId)
    if (evento.negocio?.propietario?.id !== Number(propietarioId)) {
      throw AppError.forbidden('Solo el publicador propietario puede terminar este evento')
    }

    const finAhora = new Date(Date.now() - 1000)
    const updateData = { fechaFin: finAhora }

    const inicioActual = evento.fechaInicio ? new Date(evento.fechaInicio) : null
    if (!inicioActual || Number.isNaN(inicioActual.getTime()) || inicioActual >= finAhora) {
      updateData.fechaInicio = new Date(finAhora.getTime() - 60 * 1000)
    }

    return this.eventoRepository.update(eventoId, updateData)
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

  async desapuntarse(eventoId, usuarioId) {
    const evento = await this.obtenerEventoPorId(eventoId)

    const yaInscrito = await this.eventoRepository.isUsuarioInscrito(eventoId, usuarioId)
    if (!yaInscrito) {
      throw AppError.notFound('El usuario no está inscrito en este evento')
    }

    await this.eventoRepository.desinscribirUsuario(eventoId, usuarioId)
    return {
      eventoId: evento.id,
      nombreEvento: evento.nombre,
      desinscrito: true,
    }
  }

  async aprobarEvento(eventoId, motivo = 'Aprobada por Moderador') {
    await this.obtenerEventoPorId(eventoId)
    return this.eventoRepository.update(eventoId, {
      estado: 'aprobada',
      motivo: String(motivo || 'Aprobada por Moderador').trim(),
    })
  }

  async denegarEvento(eventoId, motivo = 'Denegada por Moderador') {
    await this.obtenerEventoPorId(eventoId)
    return this.eventoRepository.update(eventoId, {
      estado: 'denegada',
      motivo: String(motivo || 'Denegada por Moderador').trim(),
    })
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

