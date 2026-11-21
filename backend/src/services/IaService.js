import { AppError } from '../middlewares/errorHandler.js'

export class IaService {
  constructor({ eventoRepository, usuarioRepository }) {
    this.eventoRepository = eventoRepository
    this.usuarioRepository = usuarioRepository
  }

  async resolverDudaEvento(eventoId, pregunta, usuarioId = null) {
    const evento = await this.eventoRepository.findById(eventoId)
    if (!evento) {
      throw AppError.notFound('Evento no encontrado para resolver la duda')
    }

    const texto = String(pregunta).toLowerCase()
    const plazasLibres = Math.max(0, evento.aforo - evento.asistentes)
    let respuesta = `Sobre "${evento.nombre}": ${evento.descripcion}`

    if (texto.includes('precio') || texto.includes('pago') || texto.includes('gratis')) {
      respuesta = evento.dePago
        ? `"${evento.nombre}" es una actividad de pago organizada por ${evento.negocio?.nombre}.`
        : `"${evento.nombre}" es una actividad gratuita.`
    } else if (texto.includes('plaza') || texto.includes('aforo') || texto.includes('sitio')) {
      respuesta = `Actualmente quedan ${plazasLibres} plazas disponibles de un aforo de ${evento.aforo}.`
    } else if (texto.includes('fecha') || texto.includes('hora') || texto.includes('cuándo')) {
      respuesta = `Comienza el ${evento.fechaInicio.toISOString()} y finaliza el ${evento.fechaFin.toISOString()}.`
    } else if (texto.includes('dónde') || texto.includes('lugar') || texto.includes('ubicación')) {
      respuesta = `La ubicación del evento tiene coordenadas ${evento.coordenadas} (${evento.negocio?.nombre}).`
    }

    return {
      eventoId: evento.id,
      usuarioId,
      pregunta,
      respuesta,
      fuente: 'ia-mock-v1',
    }
  }

  async obtenerRecomendaciones(usuarioId, preferencias = {}) {
    if (usuarioId) {
      const usuario = await this.usuarioRepository.findById(usuarioId)
      if (!usuario) {
        throw AppError.notFound('Usuario no encontrado')
      }
    }

    const todos = await this.eventoRepository.findAll()
    const historial = usuarioId ? await this.eventoRepository.findHistorialByUsuario(usuarioId) : []
    const idsInscritos = new Set(historial.map((h) => h.evento.id))

    const candidatos = todos.filter((e) => {
      if (idsInscritos.has(e.id)) return false
      if (preferencias.soloGratuitos && e.dePago) return false
      if (preferencias.tipoEvento && e.tipoEvento !== Number(preferencias.tipoEvento)) return false
      return e.asistentes < e.aforo
    })

    return {
      usuarioId: usuarioId || null,
      criterio: preferencias,
      recomendaciones: candidatos.slice(0, 5),
    }
  }
}

