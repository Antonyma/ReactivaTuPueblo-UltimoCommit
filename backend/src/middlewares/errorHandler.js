export class AppError extends Error {
  constructor(message, status = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
    this.details = details
  }

  static badRequest(message, details = null) {
    return new AppError(message, 400, 'BAD_REQUEST', details)
  }

  static unauthorized(message = 'No autenticado') {
    return new AppError(message, 401, 'UNAUTHORIZED')
  }

  static forbidden(message = 'No tienes permisos para realizar esta acción') {
    return new AppError(message, 403, 'FORBIDDEN')
  }

  static notFound(message = 'Recurso no encontrado') {
    return new AppError(message, 404, 'NOT_FOUND')
  }

  static conflict(message = 'Conflicto con el estado actual del recurso') {
    return new AppError(message, 409, 'CONFLICT')
  }
}

export function notFoundHandler(req, _res, next) {
  next(AppError.notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`))
}

export function errorHandler(err, _req, res, _next) {
  const status = err.status || 500
  const response = {
    ok: false,
    error: {
      message: err.message || 'Internal Server Error',
      code: err.code || (status === 500 ? 'INTERNAL_ERROR' : 'ERROR'),
    },
  }

  if (err.details) {
    response.error.details = err.details
  }

  if (status >= 500) {
    console.error('[ErrorHandler]', err)
  }

  res.status(status).json(response)
}
