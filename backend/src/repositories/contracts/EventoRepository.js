import { BaseRepository } from './BaseRepository.js'

export class EventoRepository extends BaseRepository {
  async inscribirUsuario(_eventoId, _usuarioId) {
    throw new Error('Método inscribirUsuario() no implementado')
  }

  async isUsuarioInscrito(_eventoId, _usuarioId) {
    throw new Error('Método isUsuarioInscrito() no implementado')
  }

  async findInscritos(_eventoId) {
    throw new Error('Método findInscritos() no implementado')
  }

  async findHistorialByUsuario(_usuarioId) {
    throw new Error('Método findHistorialByUsuario() no implementado')
  }

  async confirmarInscripcionWhatsapp(_eventoId, _usuarioId) {
    throw new Error('Método confirmarInscripcionWhatsapp() no implementado')
  }

  async confirmarPublicacionWhatsapp(_eventoId) {
    throw new Error('Método confirmarPublicacionWhatsapp() no implementado')
  }
}

