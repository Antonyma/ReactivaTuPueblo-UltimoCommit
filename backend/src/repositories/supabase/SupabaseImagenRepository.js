import { AppError } from '../../middlewares/errorHandler.js'
import { Imagen } from '../../models/index.js'
import { ImagenRepository } from '../contracts/ImagenRepository.js'
import { USUARIO_SCHEMA, mapUsuarioFromRow } from './SupabaseUsuarioRepository.js'
import { unwrapSupabaseResult } from './supabaseHelpers.js'

/**
 * Mapeo centralizado de tabla y columnas en Supabase para `public.imagen`.
 */
export const IMAGEN_SCHEMA = {
  table: 'imagen',
  publicadorRelation: 'publicador',
  columns: {
    id: 'id',
    imagen: 'imagen',
    publicadorId: 'publicador',
    eventoId: 'evento',
    createdAt: 'created_at',
  },
}

const IMAGEN_SELECT = `*, ${IMAGEN_SCHEMA.publicadorRelation}:${USUARIO_SCHEMA.table}(*)`

export function mapImagenFromRow(row) {
  if (!row || typeof row !== 'object') return null
  const cols = IMAGEN_SCHEMA.columns
  const rawPublicador = row[IMAGEN_SCHEMA.publicadorRelation]
  const publicador =
    rawPublicador && typeof rawPublicador === 'object'
      ? mapUsuarioFromRow(rawPublicador)
      : rawPublicador !== undefined && rawPublicador !== null
        ? { id: Number(rawPublicador) }
        : null

  return new Imagen({
    id: Number(row[cols.id]),
    imagen: String(row[cols.imagen] ?? ''),
    publicador,
    evento: { id: Number(row[cols.eventoId]) },
  })
}

export class SupabaseImagenRepository extends ImagenRepository {
  constructor(supabaseClient) {
    super()
    this.client = supabaseClient
  }

  async findAll(filters = {}) {
    if (filters.eventoId !== undefined) {
      return this.findByEventoId(filters.eventoId)
    }

    const result = await this.client
      .from(IMAGEN_SCHEMA.table)
      .select(IMAGEN_SELECT)
      .order(IMAGEN_SCHEMA.columns.id, { ascending: false })

    const rows = unwrapSupabaseResult(result, 'Error al listar imágenes') || []
    return rows.map(mapImagenFromRow)
  }

  async findById(id) {
    const numericId = Number(id)
    if (!Number.isInteger(numericId) || numericId <= 0) {
      throw AppError.badRequest('El id de imagen debe ser un entero positivo')
    }

    const result = await this.client
      .from(IMAGEN_SCHEMA.table)
      .select(IMAGEN_SELECT)
      .eq(IMAGEN_SCHEMA.columns.id, numericId)
      .maybeSingle()

    const row = unwrapSupabaseResult(result, 'Error al buscar imagen por id')
    return mapImagenFromRow(row)
  }

  async findByEventoId(eventoId) {
    const numericEventoId = Number(eventoId)
    if (!Number.isInteger(numericEventoId) || numericEventoId <= 0) {
      throw AppError.badRequest('El id de evento debe ser un entero positivo')
    }

    const result = await this.client
      .from(IMAGEN_SCHEMA.table)
      .select(IMAGEN_SELECT)
      .eq(IMAGEN_SCHEMA.columns.eventoId, numericEventoId)
      .order(IMAGEN_SCHEMA.columns.id, { ascending: false })

    const rows = unwrapSupabaseResult(result, 'Error al listar imágenes del evento') || []
    return rows.map(mapImagenFromRow)
  }

  async create(data) {
    const cols = IMAGEN_SCHEMA.columns
    const publicadorId = data.publicador?.id ?? data.publicadorId ?? null
    const payload = {
      [cols.imagen]: String(data.imagen ?? '').trim(),
      [cols.publicadorId]: publicadorId !== null ? Number(publicadorId) : null,
      [cols.eventoId]: Number(data.evento?.id ?? data.eventoId),
    }

    const result = await this.client
      .from(IMAGEN_SCHEMA.table)
      .insert(payload)
      .select(IMAGEN_SELECT)
      .single()

    const row = unwrapSupabaseResult(result, 'Error al guardar imagen')
    return mapImagenFromRow(row)
  }

  async delete(id) {
    const numericId = Number(id)
    if (!Number.isInteger(numericId) || numericId <= 0) {
      throw AppError.badRequest('El id de imagen debe ser un entero positivo')
    }

    const result = await this.client
      .from(IMAGEN_SCHEMA.table)
      .delete()
      .eq(IMAGEN_SCHEMA.columns.id, numericId)
      .select(IMAGEN_SCHEMA.columns.id)

    const rows = unwrapSupabaseResult(result, 'Error al eliminar imagen') || []
    return rows.length > 0
  }
}

