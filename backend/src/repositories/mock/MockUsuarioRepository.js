import { Usuario } from '../../models/index.js'
import { UsuarioRepository } from '../contracts/UsuarioRepository.js'

export class MockUsuarioRepository extends UsuarioRepository {
  constructor(store) {
    super()
    this.store = store
  }

  async findAll() {
    return [...this.store.usuarios]
  }

  async findById(id) {
    return this.store.usuarios.find((u) => u.id === Number(id)) || null
  }

  async findByEmail(email) {
    const normalized = String(email).toLowerCase().trim()
    return this.store.usuarios.find((u) => u.email.toLowerCase() === normalized) || null
  }

  async findByNombre(nombre) {
    const normalized = String(nombre).toLowerCase().trim()
    return this.store.usuarios.find((u) => u.nombre.toLowerCase() === normalized) || null
  }

  async findByAuthId(_authId) {
    return null
  }

  async findByTelefono(telefono) {
    const normalized = String(telefono).replace(/\s+/g, '')
    return (
      this.store.usuarios.find((u) => u.telefono.replace(/\s+/g, '') === normalized) || null
    )
  }

  async create(data) {
    const nextId =
      this.store.usuarios.length > 0
        ? Math.max(...this.store.usuarios.map((u) => u.id)) + 1
        : 1

    const nuevo = new Usuario({
      id: nextId,
      nombre: data.nombre,
      email: String(data.email).toLowerCase().trim(),
      telefono: data.telefono,
      tipoUsuario: data.tipoUsuario,
    })

    this.store.usuarios.push(nuevo)
    if (data.password) {
      this.store.credenciales.set(nuevo.email, data.password)
    }

    return nuevo
  }

  async update(id, data) {
    const index = this.store.usuarios.findIndex((u) => u.id === Number(id))
    if (index === -1) return null

    const current = this.store.usuarios[index]
    const updated = new Usuario({
      ...current,
      ...data,
      id: current.id,
    })
    this.store.usuarios[index] = updated
    return updated
  }

  async delete(id) {
    const index = this.store.usuarios.findIndex((u) => u.id === Number(id))
    if (index === -1) return false
    this.store.usuarios.splice(index, 1)
    return true
  }

  async registerWithAuth({ nombre, email, telefono, password, tipoUsuario }) {
    const usuario = await this.create({ nombre, email, telefono, password, tipoUsuario })
    return {
      usuario,
      token: `mock_token:${usuario.id}:${usuario.tipoUsuario}`,
    }
  }

  async loginWithNombre(nombre, password) {
    const usuario = await this.findByNombre(nombre)
    if (!usuario) return null
    const storedPassword = this.store.credenciales.get(usuario.email.toLowerCase())
    if (!storedPassword || storedPassword !== password) return null
    return {
      usuario,
      token: `mock_token:${usuario.id}:${usuario.tipoUsuario}`,
    }
  }

  async verifyCredentials(email, password) {
    const normalized = String(email).toLowerCase().trim()
    const storedPassword = this.store.credenciales.get(normalized)
    if (!storedPassword || storedPassword !== password) {
      return null
    }
    return this.findByEmail(normalized)
  }

  async solicitarPublicador(usuarioId, motivo) {
    const solicitud = {
      id: this.store.solicitudesPublicador.length + 1,
      usuarioId: Number(usuarioId),
      motivo: motivo || 'Solicitud de alta como publicador local',
      estado: 'pendiente',
      fecha: new Date(),
    }
    this.store.solicitudesPublicador.push(solicitud)
    return solicitud
  }

  async findSolicitudesPublicador(usuarioId) {
    return this.store.solicitudesPublicador.filter((s) => s.usuarioId === Number(usuarioId))
  }
}

