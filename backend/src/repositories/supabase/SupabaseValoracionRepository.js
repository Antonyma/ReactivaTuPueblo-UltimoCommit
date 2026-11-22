import { Valoracion } from '../../models/index.js'
import { ValoracionRepository } from '../contracts/ValoracionRepository.js'
import { EVENTO_SCHEMA } from './SupabaseEventoRepository.js'
import { USUARIO_SCHEMA, mapUsuarioFromRow } from './SupabaseUsuarioRepository.js'
import { assertPositiveInt, toDateOrNull, unwrapSupabaseResult } from './supabaseHelpers.js'

/**
 * Mapeo centralizado de tabla y columnas en Supabase para `public.valoraciones`.
 */
export const VALORACION_SCHEMA = {
  table: EVENTO_SCHEMA.valoracionesTable,
  usuarioRelation: 'usuario',
  columns: {
    id: 'id',
    usuarioId: 'usuario',
    eventoId: 'evento',
    texto: 'texto',
    estrellas: 'estrellas',
    fecha: 'fecha',
  },
}

const VALORACION_SELECT = `*, ${VALORACION_SCHEMA.usuarioRelation}:${USUARIO_SCHEMA.table}(*)`

export function mapValoracionFromRow(row) {
  if (!row || typeof row !== 'object') return null
  const cols = VALORACION_SCHEMA.columns
  const rawUsuario = row[VALORACION_SCHEMA.usuarioRelation]
  const usuario =
    rawUsuario && typeof rawUsuario === 'object'
      ? mapUsuarioFromRow(rawUsuario)
      : rawUsuario !== undefined && rawUsuario !== null
        ? { id: Number(rawUsuario) }
        : null

  return new Valoracion({
    id: Number(row[cols.id]),
    usuario,
    evento: { id: Number(row[cols.eventoId]) },
    texto: String(row[cols.texto] ?? ''),
    estrellas: Number(row[cols.estrellas] ?? 0),
    fecha: toDateOrNull(row[cols.fecha]) || new Date(),
  })
}

export class SupabaseValoracionRepository extends ValoracionRepository {
  constructor(supabaseClient) {
    super()
    this.client = supabaseClient
  }

  async findAll(filters = {}) {
    if (filters.eventoId !== undefined) {
      return this.findByEventoId(filters.eventoId)
    }

    const result = await this.client
      .from(VALORACION_SCHEMA.table)
      .select(VALORACION_SELECT)
      .order(VALORACION_SCHEMA.columns.fecha, { ascending: false })

    const rows = unwrapSupabaseResult(result, 'Error al listar valoraciones') || []
    return rows.map(mapValoracionFromRow)
  }

  async findById(id) {
    const numericId = assertPositiveInt(id, 'valoración')

    const result = await this.client
      .from(VALORACION_SCHEMA.table)
      .select(VALORACION_SELECT)
      .eq(VALORACION_SCHEMA.columns.id, numericId)
      .maybeSingle()

    const row = unwrapSupabaseResult(result, 'Error al buscar valoración por id')
    return mapValoracionFromRow(row)
  }

  async findByEventoId(eventoId) {
    const numericEventoId = assertPositiveInt(eventoId, 'evento')

    const result = await this.client
      .from(VALORACION_SCHEMA.table)
      .select(VALORACION_SELECT)
      .eq(VALORACION_SCHEMA.columns.eventoId, numericEventoId)
      .order(VALORACION_SCHEMA.columns.fecha, { ascending: false })

    const rows = unwrapSupabaseResult(result, 'Error al listar valoraciones del evento') || []
    return rows.map(mapValoracionFromRow)
  }

  async findByEventoIds(eventoIds) {
    const ids = [...new Set((eventoIds || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))]
    if (ids.length === 0) return []

    const result = await this.client
      .from(VALORACION_SCHEMA.table)
      .select(VALORACION_SELECT)
      .in(VALORACION_SCHEMA.columns.eventoId, ids)
      .order(VALORACION_SCHEMA.columns.fecha, { ascending: false })

    const rows = unwrapSupabaseResult(result, 'Error al listar valoraciones por eventos') || []
    return rows.map(mapValoracionFromRow)
  }

  async findByUsuarioAndEvento(usuarioId, eventoId) {
    const cols = VALORACION_SCHEMA.columns
    const result = await this.client
      .from(VALORACION_SCHEMA.table)
      .select(VALORACION_SELECT)
      .eq(cols.usuarioId, Number(usuarioId))
      .eq(cols.eventoId, Number(eventoId))
      .maybeSingle()

    const row = unwrapSupabaseResult(result, 'Error al buscar valoración del usuario')
    return mapValoracionFromRow(row)
  }

  async create(data) {
    const cols = VALORACION_SCHEMA.columns
    const payload = {
      [cols.usuarioId]: Number(data.usuario?.id ?? data.usuarioId),
      [cols.eventoId]: Number(data.evento?.id ?? data.eventoId),
      [cols.texto]: String(data.texto ?? '').trim(),
      [cols.estrellas]: Number(data.estrellas),
      [cols.fecha]: (data.fecha instanceof Date ? data.fecha : new Date()).toISOString(),
    }

    const result = await this.client
      .from(VALORACION_SCHEMA.table)
      .insert(payload)
      .select(VALORACION_SELECT)
      .single()

    const row = unwrapSupabaseResult(result, 'Error al crear valoración')
    return mapValoracionFromRow(row)
  }

  async delete(id) {
    const numericId = assertPositiveInt(id, 'valoración')

    const result = await this.client
      .from(VALORACION_SCHEMA.table)
      .delete()
      .eq(VALORACION_SCHEMA.columns.id, numericId)
      .select(VALORACION_SCHEMA.columns.id)

    const rows = unwrapSupabaseResult(result, 'Error al eliminar valoración') || []
    return rows.length > 0
  }
}

