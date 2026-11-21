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
 * Convierte un valor de fecha a Date válido o null si no aplica.
 * @param {Date|string|null|undefined} value
 * @returns {Date|null}
 */
export function toDateOrNull(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Convierte Date o string ISO a string ISO para persistir en Supabase.
 * @param {Date|string|null|undefined} value
 * @returns {string|undefined}
 */
export function toIsoString(value) {
  if (value === undefined || value === null || value === '') return undefined
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw AppError.badRequest(`Fecha inválida: ${value}`)
  }
  return date.toISOString()
}

