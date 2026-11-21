import { AppError } from '../middlewares/errorHandler.js'
import { USUARIOS } from '../models/index.js'

export class UsuarioService {
  constructor({ usuarioRepository, eventoRepository }) {
    this.usuarioRepository = usuarioRepository
    this.eventoRepository = eventoRepository
  }

  async solicitarPublicador(usuarioId, motivo) {
    const usuario = await this.usuarioRepository.findById(usuarioId)
    if (!usuario) {
      throw AppError.notFound('Usuario no encontrado')
    }

    if (usuario.tipoUsuario === USUARIOS.PUBLICADOR) {
      throw AppError.conflict('El usuario ya tiene rol de publicador')
    }

    const solicitud = await this.usuarioRepository.solicitarPublicador(usuarioId, motivo)
    return {
      usuario,
      solicitud,
    }
  }

  async obtenerHistorial(usuarioId) {
    const usuario = await this.usuarioRepository.findById(usuarioId)
    if (!usuario) {
      throw AppError.notFound('Usuario no encontrado')
    }

    const historial = await this.eventoRepository.findHistorialByUsuario(usuarioId)
    return {
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        tipoUsuario: usuario.tipoUsuario,
      },
      totalActividades: historial.length,
      historial,
    }
  }

  async listarAdmins() {
    if (this.usuarioRepository.findByTipoUsuario) {
      return this.usuarioRepository.findByTipoUsuario(USUARIOS.MODERADOR)
    }
    const usuarios = await this.usuarioRepository.findAll()
    return usuarios.filter((u) => u.tipoUsuario === USUARIOS.MODERADOR)
  }
}

