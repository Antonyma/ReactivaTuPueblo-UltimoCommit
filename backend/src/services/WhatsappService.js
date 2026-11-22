import { AppError } from '../middlewares/errorHandler.js'
import { USUARIOS } from '../models/index.js'

export class WhatsappService {
  constructor({ usuarioRepository, eventoRepository, iaService, eventoService = null, negocioRepository = null }) {
    this.usuarioRepository = usuarioRepository
    this.eventoRepository = eventoRepository
    this.iaService = iaService
    this.eventoService = eventoService
    this.negocioRepository = negocioRepository
  }

  async #buscarUsuarioPorTelefonoFlexible(telefono) {
    const rawTrimmed = String(telefono || '').replace(/\s+/g, '')
    const digits = rawTrimmed.replace(/\D+/g, '')
    if (!digits) return null

    const candidatos = new Set([rawTrimmed, digits])
    if (digits.startsWith('34') && digits.length === 11) {
      candidatos.add(`+${digits}`)
      candidatos.add(digits.slice(2))
    } else if (digits.length === 9) {
      candidatos.add(`34${digits}`)
      candidatos.add(`+34${digits}`)
    }

    for (const cand of candidatos) {
      const encontrado = await this.usuarioRepository.findByTelefono(cand)
      if (encontrado) return encontrado
    }
    return null
  }

  /**
   * Punto de entrada único del webhook de WhatsApp / Telegram.
   * Delega según el rol del usuario (`registrado` vs `publicador`) y la acción solicitada.
   */
  async procesarWebhook({ telefono, accion, eventoId, datos = {} }) {
    const usuario = await this.#buscarUsuarioPorTelefonoFlexible(telefono)
    if (!usuario) {
      throw AppError.notFound('No existe ningún usuario asociado a ese número de teléfono')
    }

    if (usuario.tipoUsuario === USUARIOS.PUBLICADOR || usuario.tipoUsuario === USUARIOS.MODERADOR) {
      return this.#procesarFlujoPublicador(usuario, { accion, eventoId, datos })
    }

    if (usuario.tipoUsuario === USUARIOS.REGISTRADO) {
      return this.#procesarFlujoRegistrado(usuario, { accion, eventoId, datos })
    }

    throw AppError.forbidden('El usuario debe estar registrado para usar los flujos de WhatsApp')
  }

  async #procesarFlujoRegistrado(usuario, { accion, eventoId, datos }) {
    switch (accion) {
      case 'duda_evento': {
        if (!eventoId || !datos.pregunta) {
          throw AppError.badRequest('Se requiere eventoId y datos.pregunta para consultar dudas')
        }
        const duda = await this.iaService.resolverDudaEvento(eventoId, datos.pregunta, usuario.id)
        return { canal: 'whatsapp', rol: USUARIOS.REGISTRADO, accion, resultado: duda }
      }

      case 'confirmar_cambios':
      case 'confirmar_asistencia': {
        if (!eventoId) {
          throw AppError.badRequest('Se requiere eventoId para confirmar cambios o asistencia')
        }
        const confirmacion = await this.eventoRepository.confirmarInscripcionWhatsapp(
          eventoId,
          usuario.id
        )
        if (!confirmacion) {
          throw AppError.notFound('No hay inscripción previa del usuario en este evento')
        }
        return {
          canal: 'whatsapp',
          rol: USUARIOS.REGISTRADO,
          accion,
          mensaje: 'Asistencia y cambios confirmados por WhatsApp',
          resultado: confirmacion,
        }
      }

      case 'notificaciones': {
        const historial = await this.eventoRepository.findHistorialByUsuario(usuario.id)
        return {
          canal: datos?.canal || 'whatsapp',
          rol: usuario.tipoUsuario,
          accion,
          notificacionesPendientes: historial.map((h) => ({
            eventoId: h.evento.id,
            nombre: h.evento.nombre,
            fechaInicio: h.evento.fechaInicio,
            confirmadaPorWhatsapp: h.confirmadaPorWhatsapp,
          })),
        }
      }

      case 'inscribirse': {
        if (!eventoId) {
          throw AppError.badRequest('Se requiere eventoId para inscribirse en una actividad')
        }
        if (!this.eventoService) {
          throw AppError.badRequest('Servicio de eventos no disponible para inscribirse')
        }
        const resultado = await this.eventoService.inscribirse(eventoId, usuario.id)
        return {
          canal: datos?.canal || 'whatsapp',
          rol: usuario.tipoUsuario,
          accion,
          mensaje: `¡Inscripción confirmada en "${resultado.nombreEvento}"!`,
          resultado,
        }
      }

      case 'desapuntarse': {
        if (!eventoId) {
          throw AppError.badRequest('Se requiere eventoId para desapuntarse de una actividad')
        }
        if (!this.eventoService) {
          throw AppError.badRequest('Servicio de eventos no disponible para desapuntarse')
        }
        const resultado = await this.eventoService.desapuntarse(eventoId, usuario.id)
        return {
          canal: datos?.canal || 'whatsapp',
          rol: usuario.tipoUsuario,
          accion,
          mensaje: `Has cancelado tu inscripción en "${resultado.nombreEvento}".`,
          resultado,
        }
      }

      default:
        throw AppError.badRequest(`Acción de WhatsApp no soportada para usuario registrado: ${accion}`)
    }
  }

  async #obtenerPendientesDePropietario(usuarioId) {
    const pendientes = await this.eventoRepository.findAll({ estado: 'pendiente_confirmacion' })
    return pendientes
      .filter((ev) => ev.negocio?.propietario?.id === Number(usuarioId))
      .sort((a, b) => Number(b.id) - Number(a.id))
  }

  async #procesarFlujoPublicador(usuario, { accion, eventoId, datos }) {
    if (
      accion === 'notificaciones' ||
      accion === 'confirmar_asistencia' ||
      accion === 'confirmar_cambios' ||
      accion === 'inscribirse' ||
      accion === 'desapuntarse'
    ) {
      return this.#procesarFlujoRegistrado(usuario, { accion, eventoId, datos })
    }

    if (accion === 'listar_pendientes_confirmacion') {
      const pendientes = await this.#obtenerPendientesDePropietario(usuario.id)
      return {
        canal: datos?.canal || 'whatsapp',
        rol: usuario.tipoUsuario,
        accion,
        totalPendientes: pendientes.length,
        eventos: pendientes.map((ev) => ({
          id: ev.id,
          nombre: ev.nombre,
          negocio: ev.negocio?.nombre || '',
          pueblo: ev.pueblo,
          fechaInicio: ev.fechaInicio,
          descripcion: ev.descripcion,
          estado: ev.estado,
        })),
      }
    }

    // Si el propietario responde SÍ o NO sin indicar ID, resolvemos automáticamente su último evento pendiente
    let targetEventoId = eventoId
    if (
      !targetEventoId &&
      (accion === 'confirmar_publicacion' || accion === 'rechazar_publicacion')
    ) {
      const pendientes = await this.#obtenerPendientesDePropietario(usuario.id)
      if (pendientes.length === 0) {
        throw AppError.notFound('No tienes ningún evento detectado pendiente de confirmación')
      }
      targetEventoId = pendientes[0].id
    }

    if (!targetEventoId) {
      throw AppError.badRequest('Se requiere eventoId para las operaciones de publicador')
    }

    const evento = await this.eventoRepository.findById(targetEventoId)
    if (!evento) {
      throw AppError.notFound('Evento no encontrado')
    }

    if (
      evento.negocio?.propietario?.id !== usuario.id &&
      usuario.tipoUsuario !== USUARIOS.MODERADOR
    ) {
      throw AppError.forbidden('Este evento no pertenece al publicador')
    }

    switch (accion) {
      case 'confirmar_publicacion': {
        if (this.eventoService && String(evento.estado).toLowerCase() === 'pendiente_confirmacion') {
          const moderacion = await this.eventoService.confirmarEventoDetectado(targetEventoId)
          await this.eventoRepository.confirmarPublicacionWhatsapp(targetEventoId).catch(() => null)
          return {
            canal: datos?.canal || 'whatsapp',
            rol: usuario.tipoUsuario,
            accion,
            eventoId: Number(targetEventoId),
            eventoNombre: moderacion.evento?.nombre || evento.nombre,
            estadoFinal: moderacion.estadoFinal,
            motivo: moderacion.motivo,
            mensaje:
              moderacion.estadoFinal === 'aprobada'
                ? `¡Listo! "${evento.nombre}" ha sido confirmado y aprobado automáticamente. Ya está visible en PuebloVivo.`
                : moderacion.estadoFinal === 'pendiente'
                  ? `¡Confirmado! "${evento.nombre}" ha pasado a la cola de moderación para su revisión final.`
                  : `"${evento.nombre}" fue confirmado pero la moderación IA lo ha denegado: ${moderacion.motivo}`,
            resultado: moderacion,
          }
        }
        const confirmacion = await this.eventoRepository.confirmarPublicacionWhatsapp(targetEventoId)
        return {
          canal: datos?.canal || 'whatsapp',
          rol: usuario.tipoUsuario,
          accion,
          mensaje: 'Publicación confirmada por WhatsApp',
          resultado: confirmacion,
        }
      }

      case 'rechazar_publicacion': {
        if (!this.eventoService) {
          throw AppError.badRequest('Servicio de eventos no disponible para descartar el evento')
        }
        const descarte = await this.eventoService.rechazarEventoDetectado(targetEventoId)
        return {
          canal: datos?.canal || 'whatsapp',
          rol: usuario.tipoUsuario,
          accion,
          eventoId: Number(targetEventoId),
          eventoNombre: evento.nombre,
          estadoFinal: 'descartada',
          mensaje: `Entendido. Hemos descartado "${evento.nombre}" y no volveremos a sugerirte esta publicación.`,
          resultado: descarte,
        }
      }

      case 'ver_inscritos': {
        const inscritos = await this.eventoRepository.findInscritos(targetEventoId)
        return {
          canal: datos?.canal || 'whatsapp',
          rol: usuario.tipoUsuario,
          accion,
          eventoId: evento.id,
          totalInscritos: inscritos.length,
          inscritos,
        }
      }

      case 'modificar_evento': {
        const camposPermitidos = [
          'nombre',
          'descripcion',
          'aforo',
          'dePago',
          'fechaInicio',
          'fechaFin',
          'pueblo',
          'coordenadas',
        ]
        const datosLimpios = {}
        for (const campo of camposPermitidos) {
          if (datos && datos[campo] !== undefined) {
            datosLimpios[campo] = datos[campo]
          }
        }
        const actualizado = await this.eventoRepository.update(targetEventoId, datosLimpios)
        return {
          canal: datos?.canal || 'whatsapp',
          rol: usuario.tipoUsuario,
          accion,
          mensaje: 'Evento modificado desde WhatsApp',
          resultado: actualizado,
        }
      }

      default:
        throw AppError.badRequest(`Acción de WhatsApp no soportada para publicador: ${accion}`)
    }
  }
}

