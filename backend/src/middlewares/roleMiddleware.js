import { AppError } from './errorHandler.js'

/**
 * Middleware de autorización por rol (`tipoUsuario`).
 * Cumple OCP: permite proteger cualquier ruta pasando los roles permitidos.
 */
export function requireRole(...allowedRoles) {
  return function roleGuard(req, _res, next) {
    if (!req.user) {
      return next(AppError.unauthorized('Debes iniciar sesión para acceder a este recurso'))
    }

    if (!allowedRoles.includes(req.user.tipoUsuario)) {
      return next(
        AppError.forbidden(
          `Acceso denegado. Se requiere uno de los roles: ${allowedRoles.join(', ')}`
        )
      )
    }

    next()
  }
}

