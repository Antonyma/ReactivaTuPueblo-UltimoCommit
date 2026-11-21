import { BaseRepository } from './BaseRepository.js'

export class NegocioRepository extends BaseRepository {
  async findByPropietarioId(_propietarioId) {
    throw new Error('Método findByPropietarioId() no implementado')
  }

  async updateRedesSociales(_negocioId, _redes) {
    throw new Error('Método updateRedesSociales() no implementado')
  }
}

