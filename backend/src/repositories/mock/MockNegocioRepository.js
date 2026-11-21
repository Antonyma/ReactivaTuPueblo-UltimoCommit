import { Negocio } from '../../models/index.js'
import { NegocioRepository } from '../contracts/NegocioRepository.js'

export class MockNegocioRepository extends NegocioRepository {
  constructor(store) {
    super()
    this.store = store
  }

  async findAll() {
    return [...this.store.negocios]
  }

  async findById(id) {
    return this.store.negocios.find((n) => n.id === Number(id)) || null
  }

  async findByPropietarioId(propietarioId) {
    return this.store.negocios.filter((n) => n.propietario?.id === Number(propietarioId))
  }

  async create(data) {
    const nextId =
      this.store.negocios.length > 0
        ? Math.max(...this.store.negocios.map((n) => n.id)) + 1
        : 1

    const nuevo = new Negocio({ ...data, id: nextId })
    this.store.negocios.push(nuevo)
    return nuevo
  }

  async update(id, data) {
    const index = this.store.negocios.findIndex((n) => n.id === Number(id))
    if (index === -1) return null

    const current = this.store.negocios[index]
    const updated = new Negocio({
      ...current,
      ...data,
      id: current.id,
    })
    this.store.negocios[index] = updated
    return updated
  }

  async updateRedesSociales(negocioId, redes) {
    const allowed = ['instagramUrl', 'facebookUrl', 'twitterUrl', 'webUrl']
    const patch = {}
    for (const key of allowed) {
      if (redes[key] !== undefined) {
        patch[key] = redes[key]
      }
    }
    return this.update(negocioId, patch)
  }

  async delete(id) {
    const index = this.store.negocios.findIndex((n) => n.id === Number(id))
    if (index === -1) return false
    this.store.negocios.splice(index, 1)
    return true
  }
}

