import { BaseRepository } from './BaseRepository.js'

export class ImagenRepository extends BaseRepository {
  async findByEventoId(_eventoId) {
    throw new Error('Método findByEventoId() no implementado')
  }
}

