import { AppError } from '../middlewares/errorHandler.js'
import { env } from '../config/env.js'

async function moderarResenaConIa(texto) {
  try {
    const res = await fetch(`${env.aiAgentsUrl}/agents/moderate/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({ texto }),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

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

    const textoLimpio = String(texto ?? '').trim()
    if (textoLimpio) {
      const modResena = await moderarResenaConIa(textoLimpio)
      if (modResena && modResena.aprobada === false) {
        throw AppError.badRequest(
          modResena.motivo || 'La reseña contiene lenguaje inapropiado y fue bloqueada por la IA'
        )
      }
    }

    return this.valoracionRepository.create({
      usuarioId,
      eventoId: evento.id,
      evento,
      estrellas: estrellasNum,
      texto: textoLimpio,
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

