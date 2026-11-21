import { AppError } from '../middlewares/errorHandler.js'
import { USUARIOS } from '../models/index.js'

export class AuthService {
  constructor({ usuarioRepository }) {
    this.usuarioRepository = usuarioRepository
  }

  #buildToken(usuario) {
    return `mock_token:${usuario.id}:${usuario.tipoUsuario}`
  }

  async register({ nombre, email, telefono, password, tipoUsuario }) {
    const existingEmail = await this.usuarioRepository.findByEmail(email)
    if (existingEmail) {
      throw AppError.conflict('Ya existe un usuario registrado con ese email')
    }

    const existingNombre = await this.usuarioRepository.findByNombre(nombre)
    if (existingNombre) {
      throw AppError.conflict('Ya existe un usuario registrado con ese nombre')
    }

    const rolPermitido = Object.values(USUARIOS).includes(tipoUsuario)
      ? tipoUsuario
      : USUARIOS.REGISTRADO

    const { usuario, token } = await this.usuarioRepository.registerWithAuth({
      nombre,
      email,
      telefono,
      password,
      tipoUsuario: rolPermitido,
    })

    return {
      usuario,
      token: token || this.#buildToken(usuario),
    }
  }

  async login({ nombre, password }) {
    const result = await this.usuarioRepository.loginWithNombre(nombre, password)
    if (!result || !result.usuario) {
      throw AppError.unauthorized('Nombre o contraseña inválidos')
    }

    return {
      usuario: result.usuario,
      token: result.token || this.#buildToken(result.usuario),
    }
  }
}

