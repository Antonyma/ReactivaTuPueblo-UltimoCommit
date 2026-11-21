import { AppError } from './errorHandler.js'

function extractBearerToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  return authHeader.slice('Bearer '.length).trim() || null
}

function parseMockToken(token) {
  if (!token || !token.startsWith('mock_token:')) {
    return null
  }

  const [, idRaw, tipoUsuario] = token.split(':')
  const id = Number(idRaw)
  if (!Number.isInteger(id) || !tipoUsuario) {
    return null
  }

  return { id, tipoUsuario }
}

async function resolveUserFromToken(token, usuarioRepository, supabaseClient) {
  if (!token) return null

  const mockParsed = parseMockToken(token)
  if (mockParsed) {
    return usuarioRepository.findById(mockParsed.id)
  }

  if (supabaseClient?.auth?.getUser) {
    const { data, error } = await supabaseClient.auth.getUser(token)
    if (error || !data?.user) {
      return null
    }
    const byAuthId = await usuarioRepository.findByAuthId(data.user.id)
    if (byAuthId) return byAuthId
    if (data.user.email) {
      return usuarioRepository.findByEmail(data.user.email)
    }
  }

  return null
}

export function createAuthMiddleware(usuarioRepository, supabaseClient = null) {
  return async function requireAuth(req, _res, next) {
    try {
      const token = extractBearerToken(req.headers.authorization)
      if (!token) {
        throw AppError.unauthorized('Token de autenticación inválido o ausente')
      }

      const usuario = await resolveUserFromToken(token, usuarioRepository, supabaseClient)
      if (!usuario) {
        throw AppError.unauthorized('Token inválido o usuario no encontrado')
      }

      req.user = usuario
      next()
    } catch (error) {
      next(error)
    }
  }
}

export function createOptionalAuthMiddleware(usuarioRepository, supabaseClient = null) {
  return async function optionalAuth(req, _res, next) {
    try {
      const token = extractBearerToken(req.headers.authorization)
      if (token) {
        const usuario = await resolveUserFromToken(token, usuarioRepository, supabaseClient)
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

