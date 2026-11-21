import { AppError } from '../middlewares/errorHandler.js'
import { USUARIOS } from '../models/index.js'

export class AuthService {
  constructor({ usuarioRepository }) {
    this.usuarioRepository = usuarioRepository
  }

  #buildToken(usuario) {
    return `mock_token:${usuario.id}:${usuario.tipoUsuario}`
  }

  async register({ nombre, email, telefono, password }) {
    const existing = await this.usuarioRepository.findByEmail(email)
    if (existing) {
      throw AppError.conflict('Ya existe un usuario registrado con ese email')
    }

    const usuario = await this.usuarioRepository.create({
      nombre,
      email,
      telefono,
      password,
      tipoUsuario: USUARIOS.REGISTRADO,
    })

    return {
      usuario,
      token: this.#buildToken(usuario),
    }
  }

  async login({ email, password }) {
    const usuario = await this.usuarioRepository.verifyCredentials(email, password)
    if (!usuario) {
      throw AppError.unauthorized('Credenciales inválidas')
    }

    return {
      usuario,
      token: this.#buildToken(usuario),
    }
  }
}

