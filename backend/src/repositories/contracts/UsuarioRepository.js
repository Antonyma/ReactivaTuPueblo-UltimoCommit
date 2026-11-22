import { BaseRepository } from './BaseRepository.js'

export class UsuarioRepository extends BaseRepository {
  async findByEmail(_email) {
    throw new Error('Método findByEmail() no implementado')
  }

  async findByNombre(_nombre) {
    throw new Error('Método findByNombre() no implementado')
  }

  async findByAuthId(_authId) {
    throw new Error('Método findByAuthId() no implementado')
  }

  async findByTelefono(_telefono) {
    throw new Error('Método findByTelefono() no implementado')
  }

  async findByTipoUsuario(_tipoUsuario) {
    throw new Error('Método findByTipoUsuario() no implementado')
  }

  async registerWithAuth(_data) {
    throw new Error('Método registerWithAuth() no implementado')
  }

  async loginWithNombre(_nombre, _password) {
    throw new Error('Método loginWithNombre() no implementado')
  }

  async solicitarPublicador(_usuarioId, _motivo) {
    throw new Error('Método solicitarPublicador() no implementado')
  }

  async findSolicitudesPublicador(_usuarioId) {
    throw new Error('Método findSolicitudesPublicador() no implementado')
  }
}

