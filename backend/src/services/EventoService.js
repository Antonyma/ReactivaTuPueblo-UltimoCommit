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

const CAMPOS_EDITABLES_EVENTO = [
  'nombre',
  'descripcion',
  'tipoEvento',
  'aforo',
  'dePago',
  'fechaInicio',
  'fechaFin',
  'pueblo',
  'coordenadas',
  'imagen',
]

function filtrarCamposEvento(data = {}) {
  const limpio = {}
  for (const campo of CAMPOS_EDITABLES_EVENTO) {
    if (data[campo] !== undefined) {
      limpio[campo] = data[campo]
    }
  }
  return limpio
}

function esUrlImagenSegura(url) {
  if (!url) return true
  const s = String(url).trim()
  return (
    s.startsWith('https://') ||
    s.startsWith('http://') ||
    s.startsWith('data:image/') ||
    s.startsWith('/')
  )
}

function notificarWebhookN8n(url, payload) {
  if (!url) return
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(5000),
    body: JSON.stringify(payload),
  }).catch((err) => {
    console.warn('[EventoService] Error enviando notificación a n8n:', err?.message || err)
  })
}

async function moderarEventoConIa(data, fiabilidadNegocio = 0) {
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (env.aiAgentsApiKey) {
      headers['X-API-Key'] = env.aiAgentsApiKey
    }
    // Escala de fiabilidad para ai-agents (0-5) derivada de la escala 0-100 del negocio
    const fiabilidadEscala = Math.round((Number(fiabilidadNegocio || 0) / 20) * 10) / 10
    const res = await fetch(`${env.aiAgentsUrl}/agents/moderate/autonomous`, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        fiabilidad_negocio: fiabilidadEscala,
        evento: {
          titulo: data.nombre,
          nombre: data.nombre,
          descripcion: data.descripcion || '',
          categoria: TIPO_EVENTO_CATEGORIA[Number(data.tipoEvento)] || 'Turismo',
          imagen: data.imagen || '',
        },
      }),
    })
    if (!res.ok) {
      console.warn(`[EventoService] Moderación IA respondió HTTP ${res.status}`)
      return null
    }
    return await res.json()
  } catch (err) {
    console.warn('[EventoService] Error al invocar moderación IA:', err?.message || err)
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
    const eventos = await this.eventoRepository.findAll(filters)
    const eventoIds = eventos.map((ev) => Number(ev.id)).filter((id) => Number.isInteger(id) && id > 0)

    let valoraciones = []
    if (this.valoracionRepository && eventoIds.length > 0) {
      const fetchVal = this.valoracionRepository.findByEventoIds
        ? this.valoracionRepository.findByEventoIds(eventoIds)
        : this.valoracionRepository.findAll()
      valoraciones = await fetchVal.catch(() => [])
    }

    const statsPorEvento = new Map()
    for (const v of valoraciones || []) {
      const evId = Number(v.evento?.id ?? v.eventoId)
      if (!evId) continue
      const prev = statsPorEvento.get(evId) || { suma: 0, total: 0 }
      prev.suma += Number(v.estrellas || 0)
      prev.total += 1
      statsPorEvento.set(evId, prev)
    }

    const sinImagen = filters.sinImagen === true || filters.sinImagen === 'true'
    const ahoraMs = Date.now()
    const fmtMadrid = (fecha) => {
      if (!fecha) return null
      const d = fecha instanceof Date ? fecha : new Date(fecha)
      if (Number.isNaN(d.getTime())) return null
      return d.toLocaleString('es-ES', {
        timeZone: 'Europe/Madrid',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    }

    return eventos.map((ev) => {
      const st = statsPorEvento.get(Number(ev.id))
      const aforo = Number(ev.aforo || 0)
      const asistentes = Number(ev.asistentes || 0)
      const finMs = ev.fechaFin ? new Date(ev.fechaFin).getTime() : NaN
      const base = {
        ...ev,
        categoria: TIPO_EVENTO_CATEGORIA[Number(ev.tipoEvento)] || 'Actividad',
        organizador: ev.negocio?.nombre || null,
        plazasLibres: aforo > 0 ? Math.max(0, aforo - asistentes) : null,
        yaFinalizado: !Number.isNaN(finMs) && finMs <= ahoraMs,
        fechaInicioMadrid: fmtMadrid(ev.fechaInicio),
        fechaFinMadrid: fmtMadrid(ev.fechaFin),
        totalValoraciones: st ? st.total : 0,
        mediaEstrellas: st && st.total > 0 ? Number((st.suma / st.total).toFixed(1)) : null,
      }
      if (sinImagen) {
        delete base.imagen
        if (base.negocio && typeof base.negocio === 'object') {
          base.negocio = {
            id: base.negocio.id,
            nombre: base.negocio.nombre,
            pueblo: base.negocio.pueblo,
            webUrl: base.negocio.webUrl || '',
            instagramUrl: base.negocio.instagramUrl || '',
          }
        }
      }
      return base
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
    const esCreadoOffline = Boolean(data.creadoOffline)
    const eventoData = filtrarCamposEvento(data)
    eventoData.negocioId = data.negocioId

    if (!esUrlImagenSegura(eventoData.imagen)) {
      throw AppError.badRequest('La URL de la imagen no tiene un esquema permitido')
    }

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
      estadoInicial = esDeConfianza ? 'aprobada' : 'pendiente'
      motivoInicial = esDeConfianza
        ? 'Pase directo por fiabilidad del negocio'
        : 'Pendiente de revisión por Moderador'

      const resultadoIa = await moderarEventoConIa(eventoData, negocio.fiabilidad)
      if (resultadoIa) {
        const decision = String(resultadoIa.decision || '').toLowerCase()
        const estadoIa = String(resultadoIa.estado_moderacion || '').toUpperCase()
        const requiereRevision =
          Boolean(resultadoIa.requiere_revision_humana) ||
          decision === 'pendiente' ||
          estadoIa === 'PENDIENTE_MODERADOR'

        if (requiereRevision) {
          estadoInicial = 'pendiente'
          motivoInicial =
            resultadoIa.motivo || 'Requiere revisión manual por el Moderador'
        } else if (typeof resultadoIa.aprobada === 'boolean') {
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

    const camposLimpios = filtrarCamposEvento(data)
    if (!esUrlImagenSegura(camposLimpios.imagen)) {
      throw AppError.badRequest('La URL de la imagen no tiene un esquema permitido')
    }

    const inicioEfectivo = camposLimpios.fechaInicio ?? evento.fechaInicio
    const finEfectivo = camposLimpios.fechaFin ?? evento.fechaFin
    if (inicioEfectivo && finEfectivo && new Date(finEfectivo) <= new Date(inicioEfectivo)) {
      throw AppError.badRequest('fechaFin debe ser posterior a fechaInicio')
    }

    const actualizado = await this.eventoRepository.update(eventoId, camposLimpios)

    const huboCambioRelevante =
      camposLimpios.fechaInicio !== undefined ||
      camposLimpios.fechaFin !== undefined ||
      camposLimpios.nombre !== undefined ||
      camposLimpios.pueblo !== undefined

    if (huboCambioRelevante && env.n8n.notifyEventChangeUrl) {
      const inscritos = await this.eventoRepository.findInscritos(eventoId).catch(() => [])
      if (inscritos.length > 0) {
        const detalle =
          camposLimpios.fechaInicio !== undefined
            ? `Nuevo horario: ${new Date(inicioEfectivo).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}`
            : 'Se han actualizado los detalles del evento.'
        notificarWebhookN8n(env.n8n.notifyEventChangeUrl, {
          eventoId: Number(eventoId),
          eventoNombre: actualizado?.nombre || evento.nombre,
          pueblo: actualizado?.pueblo || evento.pueblo,
          tipoCambio: 'actualizado',
          detalle,
          destinatarios: inscritos.map((i) => ({
            nombre: i.usuario?.nombre || i.nombre || '',
            telefono: i.usuario?.telefono || i.telefono || '',
          })),
        })
      }
    }

    return actualizado
  }

  async eliminarEvento(eventoId, propietarioId) {
    const evento = await this.obtenerEventoPorId(eventoId)
    if (evento.negocio?.propietario?.id !== Number(propietarioId)) {
      throw AppError.forbidden('Solo el publicador propietario puede eliminar este evento')
    }

    const inscritos = env.n8n.notifyEventChangeUrl
      ? await this.eventoRepository.findInscritos(eventoId).catch(() => [])
      : []

    await this.eventoRepository.delete(eventoId)

    if (inscritos.length > 0 && env.n8n.notifyEventChangeUrl) {
      notificarWebhookN8n(env.n8n.notifyEventChangeUrl, {
        eventoId: Number(eventoId),
        eventoNombre: evento.nombre,
        pueblo: evento.pueblo,
        tipoCambio: 'cancelado',
        detalle: 'El organizador ha cancelado esta actividad.',
        destinatarios: inscritos.map((i) => ({
          nombre: i.usuario?.nombre || i.nombre || '',
          telefono: i.usuario?.telefono || i.telefono || '',
        })),
      })
    }

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

    if (evento.estado && String(evento.estado).toLowerCase() !== 'aprobada') {
      throw AppError.badRequest('Solo puedes inscribirte en eventos aprobados')
    }

    if (evento.fechaFin) {
      const finMs = new Date(evento.fechaFin).getTime()
      if (!Number.isNaN(finMs) && finMs <= Date.now()) {
        throw AppError.badRequest('No puedes inscribirte en un evento que ya ha finalizado')
      }
    }

    const yaInscrito = await this.eventoRepository.isUsuarioInscrito(eventoId, usuarioId)
    if (yaInscrito) {
      throw AppError.conflict('El usuario ya está inscrito en este evento')
    }

    if (evento.asistentes >= evento.aforo) {
      throw AppError.conflict('El evento ha alcanzado el aforo máximo')
    }

    const asistentesAntes = Number(evento.asistentes || 0)
    const inscripcion = await this.eventoRepository.inscribirUsuario(eventoId, usuarioId)
    const eventoActualizado = await this.eventoRepository.findById(eventoId)
    return {
      eventoId: evento.id,
      nombreEvento: evento.nombre,
      asistentesActuales: eventoActualizado ? eventoActualizado.asistentes : asistentesAntes + 1,
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
    const evento = await this.obtenerEventoPorId(eventoId)
    const actualizado = await this.eventoRepository.update(eventoId, {
      estado: 'aprobada',
      motivo: String(motivo || 'Aprobada por Moderador').trim(),
    })
    if (env.n8n.notifyBusinessUrl && evento.negocio?.propietario?.telefono) {
      notificarWebhookN8n(env.n8n.notifyBusinessUrl, {
        negocioNombre: evento.negocio.nombre,
        propietarioTelefono: evento.negocio.propietario.telefono,
        eventoNombre: evento.nombre,
        pueblo: evento.pueblo,
        origen: 'moderacion',
        estado: 'aprobada',
        motivo: String(motivo || 'Aprobada por Moderador').trim(),
        urlWeb: env.frontendUrl,
      })
    }
    return actualizado
  }

  async denegarEvento(eventoId, motivo = 'Denegada por Moderador') {
    const evento = await this.obtenerEventoPorId(eventoId)
    const actualizado = await this.eventoRepository.update(eventoId, {
      estado: 'denegada',
      motivo: String(motivo || 'Denegada por Moderador').trim(),
    })
    if (env.n8n.notifyBusinessUrl && evento.negocio?.propietario?.telefono) {
      notificarWebhookN8n(env.n8n.notifyBusinessUrl, {
        negocioNombre: evento.negocio.nombre,
        propietarioTelefono: evento.negocio.propietario.telefono,
        eventoNombre: evento.nombre,
        pueblo: evento.pueblo,
        origen: 'moderacion',
        estado: 'denegada',
        motivo: String(motivo || 'Denegada por Moderador').trim(),
        urlWeb: env.frontendUrl,
      })
    }
    return actualizado
  }

  /**
   * Confirma un evento detectado en redes sociales tras la respuesta afirmativa del dueño
   * por WhatsApp/Telegram y lo pasa por la moderación IA actual (`moderarEventoConIa`).
   */
  async confirmarEventoDetectado(eventoId) {
    const evento = await this.obtenerEventoPorId(eventoId)
    const estadoActual = String(evento.estado || '').toLowerCase()
    if (estadoActual !== 'pendiente_confirmacion') {
      return {
        evento,
        yaProcesado: true,
        estadoFinal: estadoActual,
        motivo: evento.motivo,
      }
    }

    const negocio = evento.negocio?.id
      ? (await this.negocioRepository.findById(evento.negocio.id)) || evento.negocio
      : evento.negocio
    const fiabilidad = Number(negocio?.fiabilidad ?? 0)
    const esDeConfianza = fiabilidad >= 60

    let estadoFinal = esDeConfianza ? 'aprobada' : 'pendiente'
    let motivoFinal = esDeConfianza
      ? 'Confirmada por el propietario · Pase directo por fiabilidad del negocio'
      : 'Confirmada por el propietario · Pendiente de revisión por Moderador'

    const resultadoIa = await moderarEventoConIa(
      {
        nombre: evento.nombre,
        descripcion: evento.descripcion,
        tipoEvento: evento.tipoEvento,
        imagen: evento.imagen,
      },
      fiabilidad
    )

    if (resultadoIa) {
      const decision = String(resultadoIa.decision || '').toLowerCase()
      const estadoIa = String(resultadoIa.estado_moderacion || '').toUpperCase()
      const requiereRevision =
        Boolean(resultadoIa.requiere_revision_humana) ||
        decision === 'pendiente' ||
        estadoIa === 'PENDIENTE_MODERADOR'

      if (requiereRevision) {
        estadoFinal = 'pendiente'
        motivoFinal = resultadoIa.motivo || 'Confirmada por propietario · Requiere revisión manual por Moderador'
      } else if (typeof resultadoIa.aprobada === 'boolean') {
        estadoFinal = resultadoIa.aprobada ? 'aprobada' : 'denegada'
        motivoFinal =
          resultadoIa.motivo ||
          (resultadoIa.aprobada
            ? 'Confirmada por propietario · Aprobada por Moderador IA'
            : 'Rechazada por Moderador IA')
      }
    }

    const actualizado = await this.eventoRepository.update(eventoId, {
      estado: estadoFinal,
      motivo: motivoFinal,
    })

    return {
      evento: actualizado,
      yaProcesado: false,
      estadoFinal,
      motivo: motivoFinal,
    }
  }

  /**
   * Descarta un evento detectado en redes sociales cuando el propietario responde NO.
   * Se conserva la fila con su `url_post` para evitar volver a scrapearlo o notificarlo.
   */
  async rechazarEventoDetectado(eventoId) {
    const evento = await this.obtenerEventoPorId(eventoId)
    const actualizado = await this.eventoRepository.update(eventoId, {
      estado: 'descartada',
      motivo: 'Descartada por el propietario vía mensajería',
    })
    return {
      evento: actualizado,
      estadoFinal: 'descartada',
      motivo: 'Descartada por el propietario vía mensajería',
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
    const urlPublica = `${env.frontendUrl}/eventos/${evento.id}`
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

