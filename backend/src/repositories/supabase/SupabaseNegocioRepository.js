import { AppError } from '../../middlewares/errorHandler.js'
import { Negocio } from '../../models/index.js'
import { NegocioRepository } from '../contracts/NegocioRepository.js'
import { USUARIO_SCHEMA, mapUsuarioFromRow } from './SupabaseUsuarioRepository.js'
import { unwrapSupabaseResult } from './supabaseHelpers.js'

/**
 * Mapeo centralizado de tabla y columnas en Supabase para `public.negocio`.
 * Ajustado al esquema SQL real (FK `propietario` y columnas camelCase).
 */
export const NEGOCIO_SCHEMA = {
  table: 'negocio',
  propietarioRelation: 'propietario',
  columns: {
    id: 'id',
    nombre: 'nombre',
    propietarioId: 'propietario',
    coordenadas: 'coordenadas',
    instagramUrl: 'instagramUrl',
    facebookUrl: 'facebookUrl',
    twitterUrl: 'twitterUrl',
    webUrl: 'webUrl',
    fiabilidad: 'fiabilidad',
    pueblo: 'pueblo',
    createdAt: 'created_at',
  },
}

export const NEGOCIO_SELECT = `*, ${NEGOCIO_SCHEMA.propietarioRelation}:${USUARIO_SCHEMA.table}(*)`

export function mapNegocioFromRow(row) {
  if (!row || typeof row !== 'object') return null
  const cols = NEGOCIO_SCHEMA.columns
  const rawPropietario = row[NEGOCIO_SCHEMA.propietarioRelation]

  const propietario =
    rawPropietario && typeof rawPropietario === 'object'
      ? mapUsuarioFromRow(rawPropietario)
      : rawPropietario !== undefined && rawPropietario !== null
        ? { id: Number(rawPropietario) }
        : null

  return new Negocio({
    id: Number(row[cols.id]),
    nombre: String(row[cols.nombre] ?? ''),
    propietario,
    coordenadas: String(row[cols.coordenadas] ?? ''),
    instagramUrl: String(row[cols.instagramUrl] ?? ''),
    facebookUrl: String(row[cols.facebookUrl] ?? ''),
    twitterUrl: String(row[cols.twitterUrl] ?? ''),
    webUrl: String(row[cols.webUrl] ?? ''),
    fiabilidad:
      row[cols.fiabilidad] !== undefined && row[cols.fiabilidad] !== null
        ? Number(row[cols.fiabilidad])
        : 100,
    pueblo: String(row[cols.pueblo] ?? ''),
  })
}

function mapNegocioToRow(data) {
  const cols = NEGOCIO_SCHEMA.columns
  const row = {}

  if (data.nombre !== undefined) row[cols.nombre] = String(data.nombre).trim()
  if (data.propietarioId !== undefined) {
    row[cols.propietarioId] = Number(data.propietarioId)
  } else if (data.propietario?.id !== undefined) {
    row[cols.propietarioId] = Number(data.propietario.id)
  } else if (typeof data.propietario === 'number') {
    row[cols.propietarioId] = data.propietario
  }
  if (data.coordenadas !== undefined) row[cols.coordenadas] = String(data.coordenadas).trim()
  if (data.instagramUrl !== undefined) row[cols.instagramUrl] = String(data.instagramUrl)
  if (data.facebookUrl !== undefined) row[cols.facebookUrl] = String(data.facebookUrl)
  if (data.twitterUrl !== undefined) row[cols.twitterUrl] = String(data.twitterUrl)
  if (data.webUrl !== undefined) row[cols.webUrl] = String(data.webUrl)
  if (data.fiabilidad !== undefined) row[cols.fiabilidad] = Number(data.fiabilidad)
  if (data.pueblo !== undefined) row[cols.pueblo] = String(data.pueblo).trim()

  return row
}

export class SupabaseNegocioRepository extends NegocioRepository {
  constructor(supabaseClient) {
    super()
    this.client = supabaseClient
  }

  async findAll() {
    const result = await this.client
      .from(NEGOCIO_SCHEMA.table)
      .select(NEGOCIO_SELECT)
      .order(NEGOCIO_SCHEMA.columns.id, { ascending: true })

    const rows = unwrapSupabaseResult(result, 'Error al listar negocios') || []
    return rows.map(mapNegocioFromRow)
  }

  async findById(id) {
    const numericId = Number(id)
    if (!Number.isInteger(numericId) || numericId <= 0) {
      throw AppError.badRequest('El id de negocio debe ser un entero positivo')
    }

    const result = await this.client
      .from(NEGOCIO_SCHEMA.table)
      .select(NEGOCIO_SELECT)
      .eq(NEGOCIO_SCHEMA.columns.id, numericId)
      .maybeSingle()

    const row = unwrapSupabaseResult(result, 'Error al buscar negocio por id')
    return mapNegocioFromRow(row)
  }

  async findByPropietarioId(propietarioId) {
    const numericId = Number(propietarioId)
    if (!Number.isInteger(numericId) || numericId <= 0) {
      throw AppError.badRequest('El id de propietario debe ser un entero positivo')
    }

    const result = await this.client
      .from(NEGOCIO_SCHEMA.table)
      .select(NEGOCIO_SELECT)
      .eq(NEGOCIO_SCHEMA.columns.propietarioId, numericId)
      .order(NEGOCIO_SCHEMA.columns.id, { ascending: true })

    const rows = unwrapSupabaseResult(result, 'Error al buscar negocios por propietario') || []
    return rows.map(mapNegocioFromRow)
  }

  async create(data) {
    const payload = mapNegocioToRow(data)
    const result = await this.client
      .from(NEGOCIO_SCHEMA.table)
      .insert(payload)
      .select(NEGOCIO_SELECT)
      .single()

    const row = unwrapSupabaseResult(result, 'Error al crear negocio')
    return mapNegocioFromRow(row)
  }

  async update(id, data) {
    const numericId = Number(id)
    if (!Number.isInteger(numericId) || numericId <= 0) {
      throw AppError.badRequest('El id de negocio debe ser un entero positivo')
    }

    const payload = mapNegocioToRow(data)
    if (Object.keys(payload).length === 0) {
      return this.findById(numericId)
    }

    const result = await this.client
      .from(NEGOCIO_SCHEMA.table)
      .update(payload)
      .eq(NEGOCIO_SCHEMA.columns.id, numericId)
      .select(NEGOCIO_SELECT)
      .maybeSingle()

    const row = unwrapSupabaseResult(result, 'Error al actualizar negocio')
    return mapNegocioFromRow(row)
  }

  async updateRedesSociales(negocioId, redes = {}) {
    const allowed = ['instagramUrl', 'facebookUrl', 'twitterUrl', 'webUrl']
    const patch = {}
    for (const key of allowed) {
      if (redes[key] !== undefined) {
        patch[key] = redes[key]
      }
    }
    return this.update(negocioId, patch)
  }

  async delete(id) {
    const numericId = Number(id)
    if (!Number.isInteger(numericId) || numericId <= 0) {
      throw AppError.badRequest('El id de negocio debe ser un entero positivo')
    }

    const result = await this.client
      .from(NEGOCIO_SCHEMA.table)
      .delete()
      .eq(NEGOCIO_SCHEMA.columns.id, numericId)
      .select(NEGOCIO_SCHEMA.columns.id)

    const rows = unwrapSupabaseResult(result, 'Error al eliminar negocio') || []
    return rows.length > 0
  }
}
