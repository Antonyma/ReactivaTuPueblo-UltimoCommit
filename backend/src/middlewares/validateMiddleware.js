import { AppError } from './errorHandler.js'

/**
 * Valida que los campos obligatorios existan en `req.body` (y no sean vacíos).
 */
export function requireBodyFields(fields) {
  return function validateBody(req, _res, next) {
    const body = req.body || {}
    const missing = fields.filter(
      (field) => body[field] === undefined || body[field] === null || body[field] === ''
    )

    if (missing.length > 0) {
      return next(
        AppError.badRequest('Faltan campos obligatorios en el cuerpo de la petición', {
          missing,
        })
      )
    }

    next()
  }
}

/**
 * Valida que un parámetro de ruta sea un entero positivo.
 */
export function validateIntParam(paramName = 'id') {
  return function checkIntParam(req, _res, next) {
    const raw = req.params[paramName]
    const parsed = Number(raw)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return next(AppError.badRequest(`El parámetro '${paramName}' debe ser un entero positivo`))
    }
    req.params[paramName] = parsed
    next()
  }
}

