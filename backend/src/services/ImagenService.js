import { env } from '../config/env.js'
import { AppError } from '../middlewares/errorHandler.js'

const MAX_BATCH_IMAGENES = 10

const TIPO_EVENTO_CATEGORIA = {
  1: 'Turismo',
  2: 'Fiesta Patronal',
  3: 'Gastronomía',
  4: 'Comercio',
  5: 'Deportes',
  6: 'Cultura',
}

async function moderarImagenConIa(imagenUrl, evento) {
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (env.aiAgentsApiKey) {
      headers['X-API-Key'] = env.aiAgentsApiKey
    }
    const res = await fetch(`${env.aiAgentsUrl}/agents/moderate/image`, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        imagen_base64: imagenUrl,
        fiabilidad_negocio: 1,
        datos_evento: {
          titulo: evento.nombre,
          nombre: evento.nombre,
          categoria: TIPO_EVENTO_CATEGORIA[Number(evento.tipoEvento)] || 'Turismo',
        },
      }),
    })
    if (!res.ok) {
      return null
    }
    return await res.json()
  } catch {
    return null
  }
}

function esUrlImagenSegura(url) {
  if (!url) return false
  const s = String(url).trim()
  return (
    s.startsWith('https://') ||
    s.startsWith('http://') ||
    s.startsWith('data:image/') ||
    s.startsWith('/')
  )
}

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

  async subirImagen(eventoId, usuarioId, body = {}) {
    const evento = await this.eventoRepository.findById(eventoId)
    if (!evento) {
      throw AppError.notFound('Evento no encontrado')
    }

    const rawLista = Array.isArray(body.imagenes)
      ? body.imagenes
      : body.imagen !== undefined
        ? [body.imagen]
        : []

    const urlsLimpias = rawLista
      .map((item) => String(item ?? '').trim())
      .filter(Boolean)

    if (urlsLimpias.length === 0) {
      throw AppError.badRequest('Debes enviar al menos una imagen válida')
    }
    if (urlsLimpias.length > MAX_BATCH_IMAGENES) {
      throw AppError.badRequest(`Puedes subir como máximo ${MAX_BATCH_IMAGENES} imágenes por envío`)
    }
    for (const url of urlsLimpias) {
      if (!esUrlImagenSegura(url)) {
        throw AppError.badRequest('Una de las imágenes no tiene un formato o esquema permitido')
      }
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

    if (!esPropietario && evento.fechaFin) {
      const finMs = new Date(evento.fechaFin).getTime()
      if (!Number.isNaN(finMs) && finMs > Date.now()) {
        throw AppError.forbidden(
          'Solo se pueden subir imágenes cuando el evento haya finalizado'
        )
      }
    }

    for (const url of urlsLimpias) {
      const resIa = await moderarImagenConIa(url, evento)
      if (resIa) {
        const estadoIa = String(resIa.estado_moderacion || '').toUpperCase()
        if (estadoIa === 'RECHAZADO' || resIa.aprobada === false) {
          throw AppError.badRequest(
            resIa.motivo || 'Una de las imágenes no supera el filtro de moderación IA.'
          )
        }
      }
    }

    const creadas = []
    for (const url of urlsLimpias) {
      const nueva = await this.imagenRepository.create({
        imagen: url,
        publicadorId: usuarioId,
        eventoId: evento.id,
        evento,
      })
      creadas.push(nueva)
    }

    return Array.isArray(body.imagenes) ? creadas : creadas[0]
  }

  async eliminarImagen(eventoId, imagenId, usuarioId) {
    const evento = await this.eventoRepository.findById(eventoId)
    if (!evento) {
      throw AppError.notFound('Evento no encontrado')
    }

    const imagen = await this.imagenRepository.findById(imagenId)
    if (!imagen || imagen.evento?.id !== evento.id) {
      throw AppError.notFound('Imagen no encontrada para este evento')
    }

    const esPropietarioEvento = evento.negocio?.propietario?.id === Number(usuarioId)
    const esAutorImagen = imagen.publicador?.id === Number(usuarioId)
    if (!esPropietarioEvento && !esAutorImagen) {
      throw AppError.forbidden('No tienes permiso para eliminar esta imagen')
    }

    await this.imagenRepository.delete(imagenId)
    return { deleted: true, imagenId: Number(imagenId) }
  }
}

