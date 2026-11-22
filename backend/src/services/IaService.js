import { env } from '../config/env.js'
import { AppError } from '../middlewares/errorHandler.js'

function formatearFechaSegura(fecha) {
  if (!fecha) return 'fecha por confirmar'
  const d = fecha instanceof Date ? fecha : new Date(fecha)
  if (Number.isNaN(d.getTime())) return String(fecha)
  return d.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
}

export class IaService {
  constructor({ eventoRepository, usuarioRepository }) {
    this.eventoRepository = eventoRepository
    this.usuarioRepository = usuarioRepository
  }

  async resolverDudaEvento(eventoId, pregunta, usuarioId = null) {
    const eventoIdNum = Number(eventoId)
    if (!Number.isInteger(eventoIdNum) || eventoIdNum <= 0) {
      throw AppError.badRequest('eventoId debe ser un entero positivo')
    }

    const evento = await this.eventoRepository.findById(eventoIdNum)
    if (!evento) {
      throw AppError.notFound('Evento no encontrado para resolver la duda')
    }

    // Intentamos delegar primero en ai-agents (/agents/event-chat)
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (env.aiAgentsApiKey) {
        headers['X-API-Key'] = env.aiAgentsApiKey
      }
      const res = await fetch(`${env.aiAgentsUrl}/agents/event-chat`, {
        method: 'POST',
        headers,
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          evento: {
            id: evento.id,
            nombre: evento.nombre,
            descripcion: evento.descripcion,
            pueblo: evento.pueblo,
            coordenadas: evento.coordenadas,
            aforo: evento.aforo,
            asistentes: evento.asistentes,
            dePago: evento.dePago,
            fechaInicio: formatearFechaSegura(evento.fechaInicio),
            fechaFin: formatearFechaSegura(evento.fechaFin),
            negocio: evento.negocio?.nombre || '',
          },
          pregunta: String(pregunta),
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data?.respuesta) {
          return {
            eventoId: evento.id,
            usuarioId,
            pregunta,
            respuesta: data.respuesta,
            fuente: data.fuente || 'ai-agents',
          }
        }
      }
    } catch (err) {
      console.warn('[IaService] Fallback local en resolverDudaEvento:', err?.message || err)
    }

    const texto = String(pregunta).toLowerCase()
    const plazasLibres = Math.max(0, Number(evento.aforo || 0) - Number(evento.asistentes || 0))
    let respuesta = `Sobre "${evento.nombre}": ${evento.descripcion || 'Actividad local organizada en la comarca.'}`

    if (texto.includes('precio') || texto.includes('pago') || texto.includes('gratis')) {
      respuesta = evento.dePago
        ? `"${evento.nombre}" es una actividad de pago organizada por ${evento.negocio?.nombre || 'el organizador'}.`
        : `"${evento.nombre}" es una actividad gratuita.`
    } else if (texto.includes('plaza') || texto.includes('aforo') || texto.includes('sitio')) {
      respuesta = `Actualmente quedan ${plazasLibres} plazas disponibles de un aforo de ${evento.aforo}.`
    } else if (texto.includes('fecha') || texto.includes('hora') || texto.includes('cuándo')) {
      respuesta = `Comienza el ${formatearFechaSegura(evento.fechaInicio)} y finaliza el ${formatearFechaSegura(evento.fechaFin)}.`
    } else if (texto.includes('dónde') || texto.includes('lugar') || texto.includes('ubicación')) {
      respuesta = `Se celebra en ${evento.pueblo || 'la comarca'} (${evento.negocio?.nombre || 'ubicación local'}).`
    }

    return {
      eventoId: evento.id,
      usuarioId,
      pregunta,
      respuesta,
      fuente: 'fallback-local',
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
    const idsInscritos = new Set(historial.map((h) => Number(h.evento?.id)))
    const ahoraMs = Date.now()

    const candidatos = todos.filter((e) => {
      if (idsInscritos.has(Number(e.id))) return false
      if (e.estado && String(e.estado).toLowerCase() !== 'aprobada') return false
      if (e.fechaFin) {
        const finMs = new Date(e.fechaFin).getTime()
        if (!Number.isNaN(finMs) && finMs <= ahoraMs) return false
      }
      if (preferencias.soloGratuitos && e.dePago) return false
      if (preferencias.tipoEvento && Number(e.tipoEvento) !== Number(preferencias.tipoEvento)) return false
      return Number(e.asistentes || 0) < Number(e.aforo || 0)
    })

    // Si ai-agents está disponible y hay candidatos, pedimos ordenamiento inteligente
    if (candidatos.length > 0) {
      try {
        const headers = { 'Content-Type': 'application/json' }
        if (env.aiAgentsApiKey) {
          headers['X-API-Key'] = env.aiAgentsApiKey
        }
        const res = await fetch(`${env.aiAgentsUrl}/agents/recommend-activities`, {
          method: 'POST',
          headers,
          signal: AbortSignal.timeout(8000),
          body: JSON.stringify({
            usuario_id: usuarioId || null,
            actividades_disponibles: candidatos.map((e) => ({
              id: e.id,
              nombre: e.nombre,
              pueblo: e.pueblo,
              tipoEvento: e.tipoEvento,
              descripcion: e.descripcion || '',
              dePago: Boolean(e.dePago),
              aforo: e.aforo,
              asistentes: e.asistentes,
            })),
            max_recomendaciones: Number(preferencias.maxRecomendaciones) || 5,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          const idsOrdenados = Array.isArray(data?.recomendaciones)
            ? data.recomendaciones.map((r) => Number(r.id)).filter(Boolean)
            : []
          if (idsOrdenados.length > 0) {
            const byId = new Map(candidatos.map((c) => [Number(c.id), c]))
            const recomendadas = idsOrdenados.map((id) => byId.get(id)).filter(Boolean)
            if (recomendadas.length > 0) {
              return {
                usuarioId: usuarioId || null,
                criterio: preferencias,
                fuente: 'ai-agents',
                recomendaciones: recomendadas,
              }
            }
          }
        }
      } catch (err) {
        console.warn('[IaService] Fallback local en obtenerRecomendaciones:', err?.message || err)
      }
    }

    return {
      usuarioId: usuarioId || null,
      criterio: preferencias,
      fuente: 'fallback-local',
      recomendaciones: candidatos.slice(0, 5),
    }
  }
}

