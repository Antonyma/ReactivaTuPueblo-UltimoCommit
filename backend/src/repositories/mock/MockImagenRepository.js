import { Imagen } from '../../models/index.js'
import { ImagenRepository } from '../contracts/ImagenRepository.js'

export class MockImagenRepository extends ImagenRepository {
  constructor(store) {
    super()
    this.store = store
  }

  async findAll(filters = {}) {
    if (filters.eventoId !== undefined) {
      return this.findByEventoId(filters.eventoId)
    }
    return [...this.store.imagenes]
  }

  async findById(id) {
    return this.store.imagenes.find((img) => img.id === Number(id)) || null
  }

  async findByEventoId(eventoId) {
    const eId = Number(eventoId)
    return this.store.imagenes.filter((img) => img.evento?.id === eId)
  }

  async create(data) {
    const nextId =
      this.store.imagenes.length > 0
        ? Math.max(...this.store.imagenes.map((img) => img.id)) + 1
        : 1

    const publicador =
      data.publicador && typeof data.publicador === 'object'
        ? data.publicador
        : data.publicadorId
          ? this.store.usuarios.find((u) => u.id === Number(data.publicadorId)) || {
              id: Number(data.publicadorId),
            }
          : null

    const evento =
      data.evento && typeof data.evento === 'object'
        ? data.evento
        : this.store.eventos.find((e) => e.id === Number(data.eventoId)) || {
            id: Number(data.eventoId),
          }

    const nueva = new Imagen({
      id: nextId,
      imagen: data.imagen,
      publicador,
      evento,
    })

    this.store.imagenes.push(nueva)
    return nueva
  }

  async delete(id) {
    const index = this.store.imagenes.findIndex((img) => img.id === Number(id))
    if (index === -1) return false
    this.store.imagenes.splice(index, 1)
    return true
  }
}

