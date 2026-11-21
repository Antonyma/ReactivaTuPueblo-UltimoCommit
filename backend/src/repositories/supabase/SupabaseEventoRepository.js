import { AppError } from '../../middlewares/errorHandler.js'
import { Evento, Valoracion } from '../../models/index.js'
import { EventoRepository } from '../contracts/EventoRepository.js'
import { NEGOCIO_SCHEMA, NEGOCIO_SELECT, mapNegocioFromRow } from './SupabaseNegocioRepository.js'
import { USUARIO_SCHEMA, mapUsuarioFromRow } from './SupabaseUsuarioRepository.js'
import { toDateOrNull, toIsoString, unwrapSupabaseResult } from './supabaseHelpers.js'

/**
 * Mapeo centralizado de tablas y columnas en Supabase para `public.evento`,
 * `public.inscripcion` y `public.valoraciones`.
 * Ajustado al esquema SQL real (tablas en singular salvo `valoraciones`, FKs `negocio`/`usuario`/`evento` y camelCase).
 */
export const EVENTO_SCHEMA = {
  table: 'evento',
  inscripcionesTable: 'inscripcion',
  valoracionesTable: 'valoraciones',
  negocioRelation: 'negocio',
  columns: {
    id: 'id',
    nombre: 'nombre',
    negocioId: 'negocio',
    descripcion: 'descripcion',
    coordenadas: 'coordenadas',
    dePago: 'dePago',
    asistentes: 'asistentes',
    aforo: 'aforo',
    tipoEvento: 'tipoEvento',
    imagen: 'imagen',
    fechaInicio: 'fechaInicio',
    fechaFin: 'fechaFin',
    urlPost: 'url_post',
    createdAt: 'created_at',
  },
  inscripcionesColumns: {
    id: 'id',
    eventoId: 'evento',
    usuarioId: 'usuario',
    estado: 'estado',
    fechaInscripcion: 'fecha_inscripcion',
  },
  valoracionesColumns: {
    id: 'id',
    usuarioId: 'usuario',
    eventoId: 'evento',
    texto: 'texto',
    estrellas: 'estrellas',
    fecha: 'fecha',
  },
}

const EVENTO_SELECT = `*, ${EVENTO_SCHEMA.negocioRelation}:${NEGOCIO_SCHEMA.table}(${NEGOCIO_SELECT})`

export function mapEventoFromRow(row) {
  if (!row || typeof row !== 'object') return null
  const cols = EVENTO_SCHEMA.columns
  const rawNegocio = row[EVENTO_SCHEMA.negocioRelation]
  const negocio =
    rawNegocio && typeof rawNegocio === 'object'
      ? mapNegocioFromRow(rawNegocio)
      : rawNegocio !== undefined && rawNegocio !== null
        ? { id: Number(rawNegocio) }
        : null

  return new Evento({
    id: Number(row[cols.id]),
    nombre: String(row[cols.nombre] ?? ''),
    negocio,
    descripcion: String(row[cols.descripcion] ?? ''),
    coordenadas: String(row[cols.coordenadas] ?? ''),
    dePago: Boolean(row[cols.dePago]),
    asistentes: Number(row[cols.asistentes] ?? 0),
    aforo: Number(row[cols.aforo] ?? 0),
    tipoEvento: Number(row[cols.tipoEvento] ?? 1),
    imagen: String(row[cols.imagen] ?? ''),
    fechaInicio: toDateOrNull(row[cols.fechaInicio]) || new Date(0),
    fechaFin: toDateOrNull(row[cols.fechaFin]) || new Date(0),
  })
}

function mapEventoToRow(data, { isCreate = false } = {}) {
  const cols = EVENTO_SCHEMA.columns
  const row = {}

  if (data.nombre !== undefined) row[cols.nombre] = String(data.nombre).trim()
  if (data.negocioId !== undefined) {
    row[cols.negocioId] = data.negocioId === null ? null : Number(data.negocioId)
  } else if (data.negocio?.id !== undefined) {
    row[cols.negocioId] = Number(data.negocio.id)
  } else if (typeof data.negocio === 'number') {
    row[cols.negocioId] = data.negocio
  }
  if (data.descripcion !== undefined) row[cols.descripcion] = String(data.descripcion)
  if (data.coordenadas !== undefined) row[cols.coordenadas] = String(data.coordenadas)
  if (data.dePago !== undefined) row[cols.dePago] = Boolean(data.dePago)
  if (data.asistentes !== undefined) {
    row[cols.asistentes] = Number(data.asistentes)
  } else if (isCreate) {
    row[cols.asistentes] = 0
  }
  if (data.aforo !== undefined) row[cols.aforo] = Number(data.aforo)
  if (data.tipoEvento !== undefined) row[cols.tipoEvento] = Number(data.tipoEvento)
  if (data.imagen !== undefined) row[cols.imagen] = String(data.imagen)
  if (data.urlPost !== undefined) row[cols.urlPost] = data.urlPost

  const fechaInicioIso = toIsoString(data.fechaInicio)
  if (fechaInicioIso !== undefined) row[cols.fechaInicio] = fechaInicioIso

  const fechaFinIso = toIsoString(data.fechaFin)
  if (fechaFinIso !== undefined) row[cols.fechaFin] = fechaFinIso

  return row
}

function mapValoracionFromRow(row) {
  if (!row) return null
  const cols = EVENTO_SCHEMA.valoracionesColumns
  return new Valoracion({
    id: Number(row[cols.id]),
    usuario: { id: Number(row[cols.usuarioId]) },
    evento: { id: Number(row[cols.eventoId]) },
    texto: String(row[cols.texto] ?? ''),
    estrellas: Number(row[cols.estrellas] ?? 0),
    fecha: toDateOrNull(row[cols.fecha]) || new Date(),
  })
}

export class SupabaseEventoRepository extends EventoRepository {
  constructor(supabaseClient) {
    super()
    this.client = supabaseClient
  }

  async findAll(filters = {}) {
    const cols = EVENTO_SCHEMA.columns
    let query = this.client.from(EVENTO_SCHEMA.table).select(EVENTO_SELECT)

    if (filters.tipoEvento !== undefined && filters.tipoEvento !== '') {
      query = query.eq(cols.tipoEvento, Number(filters.tipoEvento))
    }

    if (filters.dePago !== undefined && filters.dePago !== '') {
      const dePagoBool = filters.dePago === true || filters.dePago === 'true'
      query = query.eq(cols.dePago, dePagoBool)
    }

    if (filters.fechaInicio) {
      const fromIso = toIsoString(filters.fechaInicio)
      if (fromIso) query = query.gte(cols.fechaInicio, fromIso)
    }

    if (filters.fechaFin) {
      const toIso = toIsoString(filters.fechaFin)
      if (toIso) query = query.lte(cols.fechaFin, toIso)
    }

    if (filters.negocioId !== undefined && filters.negocioId !== '') {
      query = query.eq(cols.negocioId, Number(filters.negocioId))
    }

    const result = await query.order(cols.fechaInicio, { ascending: true })
    const rows = unwrapSupabaseResult(result, 'Error al listar eventos') || []
    return rows.map(mapEventoFromRow)
  }

  async findById(id) {
    const numericId = Number(id)
    if (!Number.isInteger(numericId) || numericId <= 0) {
      throw AppError.badRequest('El id de evento debe ser un entero positivo')
    }

    const result = await this.client
      .from(EVENTO_SCHEMA.table)
      .select(EVENTO_SELECT)
      .eq(EVENTO_SCHEMA.columns.id, numericId)
      .maybeSingle()

    const row = unwrapSupabaseResult(result, 'Error al buscar evento por id')
    return mapEventoFromRow(row)
  }

  async create(data) {
    const payload = mapEventoToRow(data, { isCreate: true })
    const result = await this.client
      .from(EVENTO_SCHEMA.table)
      .insert(payload)
      .select(EVENTO_SELECT)
      .single()

    const row = unwrapSupabaseResult(result, 'Error al crear evento')
    return mapEventoFromRow(row)
  }

  async update(id, data) {
    const numericId = Number(id)
    if (!Number.isInteger(numericId) || numericId <= 0) {
      throw AppError.badRequest('El id de evento debe ser un entero positivo')
    }

    const payload = mapEventoToRow(data)
    if (Object.keys(payload).length === 0) {
      return this.findById(numericId)
    }

    const result = await this.client
      .from(EVENTO_SCHEMA.table)
      .update(payload)
      .eq(EVENTO_SCHEMA.columns.id, numericId)
      .select(EVENTO_SELECT)
      .maybeSingle()

    const row = unwrapSupabaseResult(result, 'Error al actualizar evento')
    return mapEventoFromRow(row)
  }

  async delete(id) {
    const numericId = Number(id)
    if (!Number.isInteger(numericId) || numericId <= 0) {
      throw AppError.badRequest('El id de evento debe ser un entero positivo')
    }

    const result = await this.client
      .from(EVENTO_SCHEMA.table)
      .delete()
      .eq(EVENTO_SCHEMA.columns.id, numericId)
      .select(EVENTO_SCHEMA.columns.id)

    const rows = unwrapSupabaseResult(result, 'Error al eliminar evento') || []
    return rows.length > 0
  }

  async isUsuarioInscrito(eventoId, usuarioId) {
    const cols = EVENTO_SCHEMA.inscripcionesColumns
    const result = await this.client
      .from(EVENTO_SCHEMA.inscripcionesTable)
      .select(cols.id)
      .eq(cols.eventoId, Number(eventoId))
      .eq(cols.usuarioId, Number(usuarioId))
      .neq(cols.estado, 'CANCELADA')
      .maybeSingle()

    const row = unwrapSupabaseResult(result, 'Error al comprobar inscripción')
    return Boolean(row)
  }

  async inscribirUsuario(eventoId, usuarioId) {
    const eId = Number(eventoId)
    const uId = Number(usuarioId)
    const evento = await this.findById(eId)
    if (!evento) return null

    const cols = EVENTO_SCHEMA.inscripcionesColumns
    const payload = {
      [cols.eventoId]: eId,
      [cols.usuarioId]: uId,
      [cols.estado]: 'CONFIRMADA',
      [cols.fechaInscripcion]: new Date().toISOString(),
    }

    // El trigger `trg_actualizar_asistentes` de Postgres actualiza `evento.asistentes` automáticamente
    const insertResult = await this.client
      .from(EVENTO_SCHEMA.inscripcionesTable)
      .insert(payload)
      .select('*')
      .single()

    const row = unwrapSupabaseResult(insertResult, 'Error al inscribir usuario en el evento')

    return {
      eventoId: Number(row[cols.eventoId]),
      usuarioId: Number(row[cols.usuarioId]),
      estado: row[cols.estado],
      fechaInscripcion: toDateOrNull(row[cols.fechaInscripcion]) || new Date(),
      confirmadaPorWhatsapp: row[cols.estado] === 'CONFIRMADA',
    }
  }

  async findInscritos(eventoId) {
    const cols = EVENTO_SCHEMA.inscripcionesColumns
    const result = await this.client
      .from(EVENTO_SCHEMA.inscripcionesTable)
      .select(`*, usuario:${USUARIO_SCHEMA.table}(*)`)
      .eq(cols.eventoId, Number(eventoId))
      .neq(cols.estado, 'CANCELADA')
      .order(cols.fechaInscripcion, { ascending: true })

    const rows = unwrapSupabaseResult(result, 'Error al consultar inscritos del evento') || []
    return rows
      .map((row) => {
        const usuario = mapUsuarioFromRow(row.usuario)
        if (!usuario) return null
        return {
          usuario,
          estado: row[cols.estado],
          fechaInscripcion: toDateOrNull(row[cols.fechaInscripcion]) || new Date(),
          confirmadaPorWhatsapp: row[cols.estado] === 'CONFIRMADA',
        }
      })
      .filter(Boolean)
  }

  async findHistorialByUsuario(usuarioId) {
    const uId = Number(usuarioId)
    const cols = EVENTO_SCHEMA.inscripcionesColumns

    const inscripcionesResult = await this.client
      .from(EVENTO_SCHEMA.inscripcionesTable)
      .select(`*, evento:${EVENTO_SCHEMA.table}(${EVENTO_SELECT})`)
      .eq(cols.usuarioId, uId)
      .order(cols.fechaInscripcion, { ascending: false })

    const rows =
      unwrapSupabaseResult(inscripcionesResult, 'Error al consultar historial del usuario') || []

    if (rows.length === 0) return []

    const valCols = EVENTO_SCHEMA.valoracionesColumns
    const valoracionesResult = await this.client
      .from(EVENTO_SCHEMA.valoracionesTable)
      .select('*')
      .eq(valCols.usuarioId, uId)

    const valoracionesRows = valoracionesResult.error ? [] : valoracionesResult.data || []
    const valoracionPorEvento = new Map(
      valoracionesRows.map((v) => [Number(v[valCols.eventoId]), mapValoracionFromRow(v)])
    )

    return rows
      .map((row) => {
        const evento = mapEventoFromRow(row.evento)
        if (!evento) return null
        return {
          evento,
          estado: row[cols.estado],
          fechaInscripcion: toDateOrNull(row[cols.fechaInscripcion]) || new Date(),
          confirmadaPorWhatsapp: row[cols.estado] === 'CONFIRMADA',
          valoracion: valoracionPorEvento.get(evento.id) || null,
        }
      })
      .filter(Boolean)
  }

  async confirmarInscripcionWhatsapp(eventoId, usuarioId) {
    const cols = EVENTO_SCHEMA.inscripcionesColumns
    const result = await this.client
      .from(EVENTO_SCHEMA.inscripcionesTable)
      .update({ [cols.estado]: 'CONFIRMADA' })
      .eq(cols.eventoId, Number(eventoId))
      .eq(cols.usuarioId, Number(usuarioId))
      .select('*')
      .maybeSingle()

    const row = unwrapSupabaseResult(result, 'Error al confirmar inscripción por WhatsApp')
    if (!row) return null

    return {
      eventoId: Number(row[cols.eventoId]),
      usuarioId: Number(row[cols.usuarioId]),
      estado: row[cols.estado],
      fechaInscripcion: toDateOrNull(row[cols.fechaInscripcion]) || new Date(),
      confirmadaPorWhatsapp: row[cols.estado] === 'CONFIRMADA',
    }
  }

  async confirmarPublicacionWhatsapp(eventoId) {
    const evento = await this.findById(eventoId)
    if (!evento) return null

    return {
      evento,
      confirmada: true,
      fechaConfirmacion: new Date(),
    }
  }
}
