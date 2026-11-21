import { AppError } from '../middlewares/errorHandler.js'
import { USUARIOS } from '../models/index.js'

export class WhatsappService {
  constructor({ usuarioRepository, eventoRepository, iaService }) {
    this.usuarioRepository = usuarioRepository
    this.eventoRepository = eventoRepository
    this.iaService = iaService
  }

  /**
   * Punto de entrada único del webhook de WhatsApp.
   * Delega según el rol del usuario (`registrado` vs `publicador`) y la acción solicitada.
   */
  async procesarWebhook({ telefono, accion, eventoId, datos = {} }) {
    const usuario = await this.usuarioRepository.findByTelefono(telefono)
    if (!usuario) {
      throw AppError.notFound('No existe ningún usuario asociado a ese número de teléfono')
    }

    if (usuario.tipoUsuario === USUARIOS.PUBLICADOR) {
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
          canal: 'whatsapp',
          rol: USUARIOS.REGISTRADO,
          accion,
          notificacionesPendientes: historial.map((h) => ({
            eventoId: h.evento.id,
            nombre: h.evento.nombre,
            fechaInicio: h.evento.fechaInicio,
            confirmadaPorWhatsapp: h.confirmadaPorWhatsapp,
          })),
        }
      }

      default:
        throw AppError.badRequest(`Acción de WhatsApp no soportada para usuario registrado: ${accion}`)
    }
  }

  async #procesarFlujoPublicador(usuario, { accion, eventoId, datos }) {
    if (!eventoId) {
      throw AppError.badRequest('Se requiere eventoId para las operaciones de publicador')
    }

    const evento = await this.eventoRepository.findById(eventoId)
    if (!evento) {
      throw AppError.notFound('Evento no encontrado')
    }

    if (evento.negocio?.propietario?.id !== usuario.id) {
      throw AppError.forbidden('Este evento no pertenece al publicador')
    }

    switch (accion) {
      case 'confirmar_publicacion': {
        const confirmacion = await this.eventoRepository.confirmarPublicacionWhatsapp(eventoId)
        return {
          canal: 'whatsapp',
          rol: USUARIOS.PUBLICADOR,
          accion,
          mensaje: 'Publicación confirmada por WhatsApp',
          resultado: confirmacion,
        }
      }

      case 'ver_inscritos': {
        const inscritos = await this.eventoRepository.findInscritos(eventoId)
        return {
          canal: 'whatsapp',
          rol: USUARIOS.PUBLICADOR,
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
        const actualizado = await this.eventoRepository.update(eventoId, datosLimpios)
        return {
          canal: 'whatsapp',
          rol: USUARIOS.PUBLICADOR,
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

