/**
 * Contrato base genérico para repositorios (DIP).
 * Cualquier implementación (Mock, Supabase, Postgres) debe respetar estas firmas.
 */
export class BaseRepository {
  async findAll(_filters = {}) {
    throw new Error('Método findAll() no implementado')
  }

  async findById(_id) {
    throw new Error('Método findById() no implementado')
  }

  async create(_data) {
    throw new Error('Método create() no implementado')
  }

  async update(_id, _data) {
    throw new Error('Método update() no implementado')
  }

  async delete(_id) {
    throw new Error('Método delete() no implementado')
  }
}

