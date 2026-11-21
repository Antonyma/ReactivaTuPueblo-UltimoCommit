import { BaseRepository } from './BaseRepository.js'

export class UsuarioRepository extends BaseRepository {
  async findByEmail(_email) {
    throw new Error('Método findByEmail() no implementado')
  }

  async findByTelefono(_telefono) {
    throw new Error('Método findByTelefono() no implementado')
  }

  async solicitarPublicador(_usuarioId, _motivo) {
    throw new Error('Método solicitarPublicador() no implementado')
  }

  async findSolicitudesPublicador(_usuarioId) {
    throw new Error('Método findSolicitudesPublicador() no implementado')
  }
}

