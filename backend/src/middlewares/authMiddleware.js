import { AppError } from './errorHandler.js'

/**
 * Decodifica el token mock emitido por AuthService (`mock_token:<id>:<tipoUsuario>`).
 * En producción se sustituirá por verificación JWT / Supabase Auth sin tocar rutas ni controladores.
 */
function parseAuthToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  const token = authHeader.slice('Bearer '.length).trim()
  if (!token.startsWith('mock_token:')) {
    return null
  }

  const [, idRaw, tipoUsuario] = token.split(':')
  const id = Number(idRaw)
  if (!Number.isInteger(id) || !tipoUsuario) {
    return null
  }

  return { id, tipoUsuario }
}

export function createAuthMiddleware(usuarioRepository) {
  return async function requireAuth(req, _res, next) {
    try {
      const parsed = parseAuthToken(req.headers.authorization)
      if (!parsed) {
        throw AppError.unauthorized('Token de autenticación inválido o ausente')
      }

      const usuario = await usuarioRepository.findById(parsed.id)
      if (!usuario) {
        throw AppError.unauthorized('Usuario asociado al token no existe')
      }

      req.user = usuario
      next()
    } catch (error) {
      next(error)
    }
  }
}

export function createOptionalAuthMiddleware(usuarioRepository) {
  return async function optionalAuth(req, _res, next) {
    try {
      const parsed = parseAuthToken(req.headers.authorization)
      if (parsed) {
        const usuario = await usuarioRepository.findById(parsed.id)
        if (usuario) {
          req.user = usuario
        }
      }
      next()
    } catch (error) {
      next(error)
    }
  }
}

