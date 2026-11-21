import { BaseRepository } from './BaseRepository.js'

export class ValoracionRepository extends BaseRepository {
  async findByEventoId(_eventoId) {
    throw new Error('Método findByEventoId() no implementado')
  }

  async findByUsuarioAndEvento(_usuarioId, _eventoId) {
    throw new Error('Método findByUsuarioAndEvento() no implementado')
  }
}

