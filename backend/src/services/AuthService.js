import { env } from '../config/env.js'
import { AppError } from '../middlewares/errorHandler.js'
import { USUARIOS } from '../models/index.js'

export class AuthService {
  constructor({ usuarioRepository }) {
    this.usuarioRepository = usuarioRepository
  }

  #buildToken(usuario) {
    if (env.dataSource !== 'mock') {
      throw AppError.unauthorized('No se pudo emitir un token de sesión válido')
    }
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

    const rolPermitido = [USUARIOS.REGISTRADO, USUARIOS.PUBLICADOR].includes(tipoUsuario)
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

  async loginAdmin({ nombre, password }) {
    const result = await this.usuarioRepository.loginWithNombre(nombre, password)
    if (!result || !result.usuario) {
      throw AppError.unauthorized('Usuario o contraseña de administrador inválidos')
    }

    if (result.usuario.tipoUsuario !== USUARIOS.MODERADOR) {
      throw AppError.forbidden('Acceso denegado: solo los administradores pueden iniciar sesión aquí')
    }

    return {
      usuario: result.usuario,
      token: result.token || this.#buildToken(result.usuario),
    }
  }

  async registerAdmin({ nombre, password }) {
    const existingNombre = await this.usuarioRepository.findByNombre(nombre)
    if (existingNombre) {
      throw AppError.conflict('Ya existe un usuario registrado con ese nombre')
    }

    const slug =
      String(nombre)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '.')
        .replace(/^\.+|\.+$/g, '') || 'admin'

    let generatedEmail = `${slug}@admin.pueblovivo.es`
    const existingEmail = await this.usuarioRepository.findByEmail(generatedEmail)
    if (existingEmail) {
      generatedEmail = `${slug}.${Date.now()}@admin.pueblovivo.es`
    }

    const { usuario } = await this.usuarioRepository.registerWithAuth({
      nombre,
      email: generatedEmail,
      telefono: '',
      password,
      tipoUsuario: USUARIOS.MODERADOR,
    })

    return { usuario }
  }
}

