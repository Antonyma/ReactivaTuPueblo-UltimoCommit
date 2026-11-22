import { AppError } from '../../middlewares/errorHandler.js'

/**
 * Traduce errores de Supabase/PostgREST a AppError coherentes para la API.
 * @param {import('@supabase/supabase-js').PostgrestError | Error} error
 * @param {string} context
 * @returns {never}
 */
export function throwSupabaseError(error, context = 'Error en operación de base de datos') {
  if (error instanceof AppError) {
    throw error
  }

  const code = error?.code
  const message = error?.message || 'Error desconocido en Supabase'
  const details = {
    code: code || null,
    details: error?.details || null,
    hint: error?.hint || null,
  }

  if (code === 'PGRST116') {
    throw AppError.notFound(`${context}: recurso no encontrado`)
  }

  if (code === '23505') {
    throw AppError.conflict(`${context}: ya existe un registro con esos datos`)
  }

  if (code === '23503' || code === '23502' || code === '22P02' || code === '23514') {
    throw AppError.badRequest(`${context}: datos inválidos o referencia inexistente`, details)
  }

  if (code === 'PGRST301' || error?.status === 401) {
    throw AppError.unauthorized(`${context}: credenciales o token de Supabase inválidos`)
  }

  if (error?.status === 403 || code === '42501') {
    throw AppError.forbidden(`${context}: permisos insuficientes en Supabase`)
  }

  throw new AppError(`${context}: ${message}`, 500, 'SUPABASE_ERROR', details)
}

/**
 * Ejecuta la validación estándar de respuesta `{ data, error }` de Supabase.
 * @template T
 * @param {{ data: T, error: any }} result
 * @param {string} context
 * @returns {T}
 */
export function unwrapSupabaseResult(result, context) {
  if (result?.error) {
    throwSupabaseError(result.error, context)
  }
  return result?.data
}

/**
 * Valida y convierte un ID a entero positivo.
 * @param {unknown} id
 * @param {string} label
 * @returns {number}
 */
export function assertPositiveInt(id, label = 'recurso') {
  const numericId = Number(id)
  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw AppError.badRequest(`El id de ${label} debe ser un entero positivo`)
  }
  return numericId
}

/**
 * Escapa comodines de PostgreSQL ILIKE (`%`, `_`, `\`).
 * @param {string} value
 * @returns {string}
 */
export function escapeIlike(value) {
  return String(value ?? '').replace(/[\\%_]/g, '\\$&')
}

function parseNaiveMadridToDate(str) {
  const m = str.trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return null
  const [, y, mo, d, h, mi, s = '00'] = m
  const utcGuess = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s))
  const madridStr = utcGuess.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' })
  const m2 = madridStr.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/)
  if (!m2) return utcGuess
  const madridAsUtc = Date.UTC(+m2[1], +m2[2] - 1, +m2[3], +m2[4], +m2[5], +m2[6])
  return new Date(utcGuess.getTime() - (madridAsUtc - utcGuess.getTime()))
}

function parseFechaConZonaMadrid(value) {
  if (value instanceof Date) return value
  const str = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(str)) {
    return parseNaiveMadridToDate(str) || new Date(str)
  }
  return new Date(str)
}

/**
 * Convierte un valor de fecha a Date válido o null si no aplica.
 * @param {Date|string|null|undefined} value
 * @returns {Date|null}
 */
export function toDateOrNull(value) {
  if (!value) return null
  const date = parseFechaConZonaMadrid(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Convierte Date o string ISO a string ISO para persistir en Supabase.
 * @param {Date|string|null|undefined} value
 * @returns {string|undefined}
 */
export function toIsoString(value) {
  if (value === undefined || value === null || value === '') return undefined
  const date = parseFechaConZonaMadrid(value)
  if (Number.isNaN(date.getTime())) {
    throw AppError.badRequest(`Fecha inválida: ${value}`)
  }
  return date.toISOString()
}

