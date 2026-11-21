import { Evento } from '../../models/index.js'
import { EventoRepository } from '../contracts/EventoRepository.js'

export class MockEventoRepository extends EventoRepository {
  constructor(store) {
    super()
    this.store = store
  }

  async findAll(filters = {}) {
    let result = [...this.store.eventos]

    if (filters.tipoEvento !== undefined && filters.tipoEvento !== '') {
      result = result.filter((e) => e.tipoEvento === Number(filters.tipoEvento))
    }

    if (filters.dePago !== undefined && filters.dePago !== '') {
      const dePagoBool = filters.dePago === true || filters.dePago === 'true'
      result = result.filter((e) => e.dePago === dePagoBool)
    }

    if (filters.fechaInicio) {
      const from = new Date(filters.fechaInicio)
      if (!Number.isNaN(from.getTime())) {
        result = result.filter((e) => e.fechaInicio >= from)
      }
    }

    if (filters.fechaFin) {
      const to = new Date(filters.fechaFin)
      if (!Number.isNaN(to.getTime())) {
        result = result.filter((e) => e.fechaFin <= to)
      }
    }

    if (filters.negocioId !== undefined) {
      result = result.filter((e) => e.negocio?.id === Number(filters.negocioId))
    }

    return result
  }

  async findById(id) {
    return this.store.eventos.find((e) => e.id === Number(id)) || null
  }

  async create(data) {
    const nextId =
      this.store.eventos.length > 0
        ? Math.max(...this.store.eventos.map((e) => e.id)) + 1
        : 1

    const nuevo = new Evento({
      ...data,
      id: nextId,
      asistentes: 0,
    })
    this.store.eventos.push(nuevo)
    this.store.publicacionesWhatsapp.set(nuevo.id, {
      confirmada: false,
      fechaConfirmacion: null,
    })
    return nuevo
  }

  async update(id, data) {
    const index = this.store.eventos.findIndex((e) => e.id === Number(id))
    if (index === -1) return null

    const current = this.store.eventos[index]
    const updated = new Evento({
      ...current,
      ...data,
      id: current.id,
    })
    this.store.eventos[index] = updated
    return updated
  }

  async delete(id) {
    const eventoId = Number(id)
    const index = this.store.eventos.findIndex((e) => e.id === eventoId)
    if (index === -1) return false

    this.store.eventos.splice(index, 1)
    this.store.inscripciones = this.store.inscripciones.filter((i) => i.eventoId !== eventoId)
    this.store.publicacionesWhatsapp.delete(eventoId)
    return true
  }

  async isUsuarioInscrito(eventoId, usuarioId) {
    return this.store.inscripciones.some(
      (i) => i.eventoId === Number(eventoId) && i.usuarioId === Number(usuarioId)
    )
  }

  async inscribirUsuario(eventoId, usuarioId) {
    const eId = Number(eventoId)
    const uId = Number(usuarioId)
    const evento = await this.findById(eId)
    if (!evento) return null

    const inscripcion = {
      eventoId: eId,
      usuarioId: uId,
      fechaInscripcion: new Date(),
      confirmadaPorWhatsapp: false,
    }
    this.store.inscripciones.push(inscripcion)
    evento.asistentes += 1
    return inscripcion
  }

  async desinscribirUsuario(eventoId, usuarioId) {
    const eId = Number(eventoId)
    const uId = Number(usuarioId)
    const idx = this.store.inscripciones.findIndex(
      (i) => i.eventoId === eId && i.usuarioId === uId
    )
    if (idx === -1) return false
    this.store.inscripciones.splice(idx, 1)
    const evento = await this.findById(eId)
    if (evento) {
      evento.asistentes = Math.max(0, evento.asistentes - 1)
    }
    return true
  }

  async findInscritos(eventoId) {
    const eId = Number(eventoId)
    const registros = this.store.inscripciones.filter((i) => i.eventoId === eId)
    return registros
      .map((reg) => {
        const usuario = this.store.usuarios.find((u) => u.id === reg.usuarioId)
        if (!usuario) return null
        return {
          usuario,
          fechaInscripcion: reg.fechaInscripcion,
          confirmadaPorWhatsapp: reg.confirmadaPorWhatsapp,
        }
      })
      .filter(Boolean)
  }

  async findHistorialByUsuario(usuarioId) {
    const uId = Number(usuarioId)
    const registros = this.store.inscripciones.filter((i) => i.usuarioId === uId)
    return registros
      .map((reg) => {
        const evento = this.store.eventos.find((e) => e.id === reg.eventoId)
        if (!evento) return null
        const valoracion =
          this.store.valoraciones.find(
            (v) => v.evento?.id === evento.id && v.usuario?.id === uId
          ) || null
        return {
          evento,
          fechaInscripcion: reg.fechaInscripcion,
          confirmadaPorWhatsapp: reg.confirmadaPorWhatsapp,
          valoracion,
        }
      })
      .filter(Boolean)
  }

  async confirmarInscripcionWhatsapp(eventoId, usuarioId) {
    const reg = this.store.inscripciones.find(
      (i) => i.eventoId === Number(eventoId) && i.usuarioId === Number(usuarioId)
    )
    if (!reg) return null
    reg.confirmadaPorWhatsapp = true
    return reg
  }

  async confirmarPublicacionWhatsapp(eventoId) {
    const eId = Number(eventoId)
    const evento = await this.findById(eId)
    if (!evento) return null

    const status = { confirmada: true, fechaConfirmacion: new Date() }
    this.store.publicacionesWhatsapp.set(eId, status)
    return { evento, ...status }
  }
}

