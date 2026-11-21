import { AppError } from '../middlewares/errorHandler.js'
import { USUARIOS } from '../models/index.js'

export class UsuarioController {
  constructor({ usuarioService }) {
    this.usuarioService = usuarioService
  }

  solicitarPublicador = async (req, res) => {
    const { id } = req.params
    if (req.user && Number(req.user.id) !== Number(id) && req.user.tipoUsuario !== USUARIOS.MODERADOR) {
      throw AppError.forbidden('Solo puedes solicitar el alta de publicador para tu propia cuenta')
    }
    const { motivo } = req.body || {}
    const result = await this.usuarioService.solicitarPublicador(id, motivo)

    res.status(201).json({
      ok: true,
      message: 'Solicitud para ser publicador registrada',
      data: result,
    })
  }

  obtenerHistorial = async (req, res) => {
    const { id } = req.params
    if (req.user && Number(req.user.id) !== Number(id) && req.user.tipoUsuario !== USUARIOS.MODERADOR) {
      throw AppError.forbidden('No tienes permisos para consultar el historial de otro usuario')
    }
    const result = await this.usuarioService.obtenerHistorial(id)

    res.status(200).json({
      ok: true,
      data: result,
    })
  }

  listarAdmins = async (_req, res) => {
    const admins = await this.usuarioService.listarAdmins()
    res.status(200).json({
      ok: true,
      data: admins,
    })
  }
}

