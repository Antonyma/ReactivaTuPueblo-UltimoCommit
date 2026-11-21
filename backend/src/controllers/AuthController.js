export class AuthController {
  constructor({ authService }) {
    this.authService = authService
  }

  register = async (req, res) => {
    const result = await this.authService.register(req.body)
    res.status(201).json({
      ok: true,
      message: 'Usuario registrado correctamente',
      data: result,
    })
  }

  login = async (req, res) => {
    const result = await this.authService.login(req.body)
    res.status(200).json({
      ok: true,
      message: 'Inicio de sesión correcto',
      data: result,
    })
  }

  loginAdmin = async (req, res) => {
    const result = await this.authService.loginAdmin(req.body)
    res.status(200).json({
      ok: true,
      message: 'Inicio de sesión de administrador correcto',
      data: result,
    })
  }

  registerAdmin = async (req, res) => {
    const result = await this.authService.registerAdmin(req.body)
    res.status(201).json({
      ok: true,
      message: 'Administrador dado de alta correctamente',
      data: result,
    })
  }

  me = async (req, res) => {
    res.status(200).json({
      ok: true,
      data: { usuario: req.user },
    })
  }
}

