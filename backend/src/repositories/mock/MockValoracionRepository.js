import { Valoracion } from '../../models/index.js'
import { ValoracionRepository } from '../contracts/ValoracionRepository.js'

export class MockValoracionRepository extends ValoracionRepository {
  constructor(store) {
    super()
    this.store = store
  }

  async findAll(filters = {}) {
    if (filters.eventoId !== undefined) {
      return this.findByEventoId(filters.eventoId)
    }
    return [...this.store.valoraciones]
  }

  async findById(id) {
    return this.store.valoraciones.find((v) => v.id === Number(id)) || null
  }

  async findByEventoId(eventoId) {
    const eId = Number(eventoId)
    return this.store.valoraciones.filter((v) => v.evento?.id === eId)
  }

  async findByEventoIds(eventoIds) {
    const ids = new Set((eventoIds || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))
    if (ids.size === 0) return []
    return this.store.valoraciones.filter((v) => ids.has(Number(v.evento?.id)))
  }

  async findByUsuarioAndEvento(usuarioId, eventoId) {
    const uId = Number(usuarioId)
    const eId = Number(eventoId)
    return (
      this.store.valoraciones.find((v) => v.usuario?.id === uId && v.evento?.id === eId) || null
    )
  }

  async create(data) {
    const nextId =
      this.store.valoraciones.length > 0
        ? Math.max(...this.store.valoraciones.map((v) => v.id)) + 1
        : 1

    const usuario =
      data.usuario && typeof data.usuario === 'object'
        ? data.usuario
        : this.store.usuarios.find((u) => u.id === Number(data.usuarioId)) || {
            id: Number(data.usuarioId),
          }

    const evento =
      data.evento && typeof data.evento === 'object'
        ? data.evento
        : this.store.eventos.find((e) => e.id === Number(data.eventoId)) || {
            id: Number(data.eventoId),
          }

    const nueva = new Valoracion({
      id: nextId,
      usuario,
      evento,
      texto: data.texto || '',
      estrellas: data.estrellas,
      fecha: data.fecha || new Date(),
    })

    this.store.valoraciones.push(nueva)
    return nueva
  }

  async delete(id) {
    const index = this.store.valoraciones.findIndex((v) => v.id === Number(id))
    if (index === -1) return false
    this.store.valoraciones.splice(index, 1)
    return true
  }
}

