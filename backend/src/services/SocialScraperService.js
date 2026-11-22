import { env } from '../config/env.js'
import { AppError } from '../middlewares/errorHandler.js'
import { USUARIOS } from '../models/index.js'

function normalizarTexto(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function construirHuella(negocioId, nombre, fechaInicio) {
  const fecha = fechaInicio instanceof Date ? fechaInicio : new Date(fechaInicio)
  const fechaDia = Number.isNaN(fecha.getTime())
    ? String(fechaInicio || '').slice(0, 10)
    : fecha.toISOString().slice(0, 10)
  return `${negocioId}|${normalizarTexto(nombre)}|${fechaDia}`
}

function esUrlImagenSegura(url) {
  if (!url) return true
  const s = String(url).trim()
  return s.startsWith('https://') || s.startsWith('http://') || s.startsWith('/')
}

function tieneRedesConfiguradas(negocio) {
  return Boolean(
    negocio?.instagramUrl?.trim() ||
      negocio?.facebookUrl?.trim() ||
      negocio?.twitterUrl?.trim() ||
      negocio?.webUrl?.trim()
  )
}

function notificarWebhookN8n(url, payload) {
  if (!url) return Promise.resolve(false)
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify(payload),
  })
    .then((res) => res.ok)
    .catch((err) => {
      console.warn('[SocialScraperService] Error enviando notificación a n8n:', err?.message || err)
      return false
    })
}

export class SocialScraperService {
  constructor({ negocioRepository, eventoRepository, scraperFetcher = null, notifier = null }) {
    this.negocioRepository = negocioRepository
    this.eventoRepository = eventoRepository
    this.scraperFetcher = scraperFetcher
    this.notifier = notifier
  }

  async #invocarAiScraper(payload, onProgress = null) {
    if (this.scraperFetcher) {
      return this.scraperFetcher(payload)
    }

    const headers = { 'Content-Type': 'application/json' }
    if (env.aiAgentsApiKey) {
      headers['X-API-Key'] = env.aiAgentsApiKey
    }

    if (typeof onProgress === 'function') {
      const res = await fetch(`${env.aiAgentsUrl}/agents/scrape-business-socials/stream`, {
        method: 'POST',
        headers,
        signal: AbortSignal.timeout(90000),
        body: JSON.stringify(payload),
      })

      if (res.ok && res.body) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let finalResult = null

        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const parts = buffer.split('\n\n')
          buffer = parts.pop() || ''

          for (const part of parts) {
            const dataLine = part
              .split('\n')
              .find((line) => line.startsWith('data:'))
            if (!dataLine) continue
            let evt = null
            try {
              evt = JSON.parse(dataLine.slice(5).trim())
            } catch {
              continue
            }
            if (evt?.type === 'progress') {
              onProgress(Number(evt.progress) || 0, String(evt.message || ''))
            } else if (evt?.type === 'result') {
              finalResult = evt.data
            } else if (evt?.type === 'error') {
              throw AppError.badRequest(evt.message || 'Error en el servicio de scraping IA')
            }
          }
        }

        if (finalResult) {
          return finalResult
        }
      } else if (res.status !== 404) {
        const detail = await res.text().catch(() => '')
        throw AppError.badRequest(
          `El servicio de scraping IA respondió HTTP ${res.status}${detail ? `: ${detail}` : ''}`
        )
      }
    }

    const res = await fetch(`${env.aiAgentsUrl}/agents/scrape-business-socials`, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(60000),
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw AppError.badRequest(
        `El servicio de scraping IA respondió HTTP ${res.status}${detail ? `: ${detail}` : ''}`
      )
    }

    return res.json()
  }

  async #enviarNotificacionConfirmacion(negocio, evento, redSocial, telegramChatId = '') {
    const payload = {
      origen: 'confirmacion_rrss',
      eventoId: evento.id,
      negocioId: negocio.id,
      negocioNombre: negocio.nombre,
      propietarioTelefono: negocio.propietario?.telefono || '',
      telegramChatId: telegramChatId || '',
      eventoNombre: evento.nombre,
      descripcion: evento.descripcion,
      fechaInicio: evento.fechaInicio instanceof Date ? evento.fechaInicio.toISOString() : evento.fechaInicio,
      pueblo: evento.pueblo || negocio.pueblo || '',
      redSocial: redSocial || 'Redes Sociales',
      urlPost: evento.urlPost || '',
      urlWeb: env.frontendUrl,
    }

    if (this.notifier) {
      return this.notifier(payload)
    }

    return notificarWebhookN8n(env.n8n.notifyBusinessUrl, payload)
  }

  /**
   * Escanea las redes sociales y web de un negocio concreto, crea eventos nuevos en
   * estado `pendiente_confirmacion` (sin duplicados) y notifica al propietario.
   */
  async escanearNegocio(
    negocioId,
    { user = null, esSistema = false, opciones = {}, onProgress = null } = {}
  ) {
    const emit = (progress, message) => {
      if (typeof onProgress === 'function') {
        try {
          onProgress({ progress, message })
        } catch {
          // ignore listener errors
        }
      }
    }

    emit(5, 'Comprobando negocio y redes configuradas...')
    const negocio = await this.negocioRepository.findById(negocioId)
    if (!negocio) {
      throw AppError.notFound('Negocio no encontrado')
    }

    if (!esSistema) {
      const esModerador = user?.tipoUsuario === USUARIOS.MODERADOR
      const esPropietario = negocio.propietario?.id === Number(user?.id)
      if (!esModerador && !esPropietario) {
        throw AppError.forbidden('Solo el propietario del negocio o un moderador puede escanear sus redes')
      }
    }

    if (Number(negocio.fiabilidad ?? 0) <= 0) {
      throw AppError.forbidden('Este comercio está pendiente de confirmación por un moderador')
    }

    const tieneTextoManual = Boolean(opciones?.textoManual && String(opciones.textoManual).trim())
    if (!tieneRedesConfiguradas(negocio) && !tieneTextoManual) {
      emit(100, 'Sin URLs configuradas.')
      return {
        negocioId: negocio.id,
        negocioNombre: negocio.nombre,
        fuentesAnalizadas: 0,
        eventosCreados: [],
        duplicadosOmitidos: 0,
        notificacionesEnviadas: 0,
        mensaje: 'Este negocio no tiene URLs de redes sociales ni web configuradas.',
      }
    }

    // Recoger TODOS los eventos previos del negocio (incluyendo pendiente_confirmacion, descartada, denegada)
    emit(10, 'Consultando eventos previos para evitar duplicados...')
    const eventosPrevios = await this.eventoRepository.findAll({ negocioId: negocio.id })
    const urlsExistentes = new Set()
    const huellasExistentes = new Set()

    for (const ev of eventosPrevios) {
      if (ev.urlPost) urlsExistentes.add(String(ev.urlPost).trim())
      huellasExistentes.add(construirHuella(negocio.id, ev.nombre, ev.fechaInicio))
    }

    const resultadoIa = await this.#invocarAiScraper(
      {
        negocio: {
          id: negocio.id,
          nombre: negocio.nombre,
          pueblo: negocio.pueblo,
          coordenadas: negocio.coordenadas,
          instagramUrl: negocio.instagramUrl,
          facebookUrl: negocio.facebookUrl,
          twitterUrl: negocio.twitterUrl,
          webUrl: negocio.webUrl,
        },
        urls_existentes: Array.from(urlsExistentes),
        huellas_existentes: Array.from(huellasExistentes),
        texto_manual: opciones?.textoManual || null,
        red_manual: opciones?.redManual || null,
        url_post_manual: opciones?.urlPostManual || null,
      },
      onProgress ? (pct, msg) => emit(Math.min(82, Math.max(12, pct)), msg) : null
    )

    const candidatos = Array.isArray(resultadoIa?.eventosNuevos) ? resultadoIa.eventosNuevos : []
    const eventosCreados = []
    let duplicadosOmitidos = Number(resultadoIa?.duplicadosOmitidos || 0)
    let notificacionesEnviadas = 0

    if (candidatos.length > 0) {
      emit(86, `Guardando ${candidatos.length} evento(s) nuevo(s) y avisando por WhatsApp/Telegram...`)
    } else {
      emit(92, 'Finalizando comprobación...')
    }

    for (const cand of candidatos) {
      const urlPost = String(cand.urlPost || '').trim()
      const huella = construirHuella(negocio.id, cand.nombre, cand.fechaInicio)

      // Doble verificación en base de datos antes de insertar
      if (urlPost && urlsExistentes.has(urlPost)) {
        duplicadosOmitidos += 1
        continue
      }
      if (huellasExistentes.has(huella)) {
        duplicadosOmitidos += 1
        continue
      }
      if (urlPost && this.eventoRepository.findByUrlPost) {
        const yaEnDb = await this.eventoRepository.findByUrlPost(urlPost)
        if (yaEnDb) {
          urlsExistentes.add(urlPost)
          duplicadosOmitidos += 1
          continue
        }
      }

      const fechaInicio = new Date(cand.fechaInicio)
      let fechaFin = cand.fechaFin ? new Date(cand.fechaFin) : new Date(fechaInicio.getTime() + 2 * 3600 * 1000)
      if (Number.isNaN(fechaInicio.getTime())) continue
      if (Number.isNaN(fechaFin.getTime()) || fechaFin <= fechaInicio) {
        fechaFin = new Date(fechaInicio.getTime() + 2 * 3600 * 1000)
      }

      const redSocial = String(cand.redSocial || 'Redes Sociales').trim()
      const imagenSegura = esUrlImagenSegura(cand.imagen) ? String(cand.imagen || '').trim() : ''

      const creado = await this.eventoRepository.create({
        nombre: String(cand.nombre).trim(),
        negocio,
        negocioId: negocio.id,
        descripcion: String(cand.descripcion || '').trim(),
        coordenadas: negocio.coordenadas || '',
        dePago: Boolean(cand.dePago),
        aforo: Math.max(1, Number(cand.aforo) || 40),
        tipoEvento: Math.min(6, Math.max(1, Number(cand.tipoEvento) || 4)),
        imagen: imagenSegura,
        fechaInicio,
        fechaFin,
        pueblo: negocio.pueblo || '',
        estado: 'pendiente_confirmacion',
        motivo: `Detectado automáticamente en ${redSocial} · Pendiente de confirmación del propietario`,
        urlPost,
      })

      if (urlPost) urlsExistentes.add(urlPost)
      huellasExistentes.add(huella)
      eventosCreados.push(creado)

      const enviado = await this.#enviarNotificacionConfirmacion(
        negocio,
        creado,
        redSocial,
        opciones?.telegramChatId || ''
      )
      if (enviado) notificacionesEnviadas += 1
    }

    emit(100, 'Escaneo completado.')
    return {
      negocioId: negocio.id,
      negocioNombre: negocio.nombre,
      fuentesAnalizadas: Number(resultadoIa?.fuentesAnalizadas || 0),
      eventosCreados,
      totalDetectados: eventosCreados.length,
      duplicadosOmitidos,
      notificacionesEnviadas,
      mensaje:
        eventosCreados.length > 0
          ? `Se detectaron ${eventosCreados.length} evento(s) nuevo(s). Revisa tu WhatsApp o Telegram para confirmar su publicación.`
          : 'No se encontraron eventos nuevos en las redes configuradas.',
    }
  }

  /**
   * Escanea todos los negocios confirmados que tengan URLs de redes sociales o web.
   */
  async escanearTodosLosNegocios() {
    const negocios = await this.negocioRepository.findAll()
    const elegibles = negocios.filter(
      (n) => Number(n.fiabilidad ?? 0) > 0 && tieneRedesConfiguradas(n)
    )

    const resultados = []
    let totalEventosCreados = 0
    let totalDuplicadosOmitidos = 0
    let totalErrores = 0

    for (const negocio of elegibles) {
      try {
        const res = await this.escanearNegocio(negocio.id, { esSistema: true })
        totalEventosCreados += res.totalDetectados || 0
        totalDuplicadosOmitidos += res.duplicadosOmitidos || 0
        resultados.push({
          negocioId: negocio.id,
          negocioNombre: negocio.nombre,
          ok: true,
          totalDetectados: res.totalDetectados || 0,
          duplicadosOmitidos: res.duplicadosOmitidos || 0,
        })
      } catch (err) {
        totalErrores += 1
        resultados.push({
          negocioId: negocio.id,
          negocioNombre: negocio.nombre,
          ok: false,
          error: err?.message || 'Error al escanear negocio',
        })
      }
    }

    return {
      negociosEvaluados: elegibles.length,
      totalEventosCreados,
      totalDuplicadosOmitidos,
      totalErrores,
      resultados,
    }
  }
}

