import { AppError } from '../../middlewares/errorHandler.js'
import { USUARIOS, Usuario } from '../../models/index.js'
import { UsuarioRepository } from '../contracts/UsuarioRepository.js'
import { unwrapSupabaseResult } from './supabaseHelpers.js'

/**
 * Mapeo centralizado de tabla y columnas en Supabase para `public.usuario`.
 * Ajustado al esquema SQL real (rol_usuario ENUM y columnas exactas).
 */
export const USUARIO_SCHEMA = {
  table: 'usuario',
  columns: {
    id: 'id',
    authId: 'auth_id',
    nombre: 'nombre',
    email: 'email',
    telefono: 'telefono',
    tipoUsuario: 'tipoUsuario',
    createdAt: 'created_at',
  },
}

const DB_ROLE_TO_JS = {
  NO_REGISTRADO: USUARIOS.NO_REGISTRADO,
  REGISTRADO: USUARIOS.REGISTRADO,
  PUBLICADOR: USUARIOS.PUBLICADOR,
}

const JS_ROLE_TO_DB = {
  [USUARIOS.NO_REGISTRADO]: 'NO_REGISTRADO',
  [USUARIOS.REGISTRADO]: 'REGISTRADO',
  [USUARIOS.PUBLICADOR]: 'PUBLICADOR',
  NO_REGISTRADO: 'NO_REGISTRADO',
  REGISTRADO: 'REGISTRADO',
  PUBLICADOR: 'PUBLICADOR',
}

function normalizeTelefonoToBigInt(telefono) {
  if (telefono === undefined || telefono === null || telefono === '') return null
  const digits = String(telefono).replace(/\D+/g, '')
  if (!digits) return null
  const numeric = Number(digits)
  return Number.isSafeInteger(numeric) ? numeric : digits
}

export function mapUsuarioFromRow(row) {
  if (!row || typeof row !== 'object') return null
  const cols = USUARIO_SCHEMA.columns
  const rawRole = row[cols.tipoUsuario]
  return new Usuario({
    id: Number(row[cols.id]),
    nombre: String(row[cols.nombre] ?? ''),
    email: String(row[cols.email] ?? ''),
    telefono: row[cols.telefono] !== null && row[cols.telefono] !== undefined
      ? String(row[cols.telefono])
      : '',
    tipoUsuario: DB_ROLE_TO_JS[rawRole] || USUARIOS.NO_REGISTRADO,
  })
}

function mapUsuarioToRow(data, { isCreate = false } = {}) {
  const cols = USUARIO_SCHEMA.columns
  const row = {}

  if (data.authId !== undefined) row[cols.authId] = data.authId
  if (data.nombre !== undefined) row[cols.nombre] = String(data.nombre).trim()
  if (data.email !== undefined) row[cols.email] = String(data.email).toLowerCase().trim()
  if (data.telefono !== undefined) {
    const tel = normalizeTelefonoToBigInt(data.telefono)
    if (tel !== null) row[cols.telefono] = tel
  }
  if (data.tipoUsuario !== undefined) {
    row[cols.tipoUsuario] = JS_ROLE_TO_DB[data.tipoUsuario] || 'REGISTRADO'
  } else if (isCreate) {
    row[cols.tipoUsuario] = 'REGISTRADO'
  }

  return row
}

export class SupabaseUsuarioRepository extends UsuarioRepository {
  constructor(supabaseClient) {
    super()
    this.client = supabaseClient
  }

  async findAll() {
    const result = await this.client
      .from(USUARIO_SCHEMA.table)
      .select('*')
      .order(USUARIO_SCHEMA.columns.id, { ascending: true })

    const rows = unwrapSupabaseResult(result, 'Error al listar usuarios') || []
    return rows.map(mapUsuarioFromRow)
  }

  async findById(id) {
    const numericId = Number(id)
    if (!Number.isInteger(numericId) || numericId <= 0) {
      throw AppError.badRequest('El id de usuario debe ser un entero positivo')
    }

    const result = await this.client
      .from(USUARIO_SCHEMA.table)
      .select('*')
      .eq(USUARIO_SCHEMA.columns.id, numericId)
      .maybeSingle()

    const row = unwrapSupabaseResult(result, 'Error al buscar usuario por id')
    return mapUsuarioFromRow(row)
  }

  async findByEmail(email) {
    const normalized = String(email || '').toLowerCase().trim()
    if (!normalized) return null

    const result = await this.client
      .from(USUARIO_SCHEMA.table)
      .select('*')
      .ilike(USUARIO_SCHEMA.columns.email, normalized)
      .maybeSingle()

    const row = unwrapSupabaseResult(result, 'Error al buscar usuario por email')
    return mapUsuarioFromRow(row)
  }

  async findByTelefono(telefono) {
    const normalized = normalizeTelefonoToBigInt(telefono)
    if (normalized === null) return null

    const result = await this.client
      .from(USUARIO_SCHEMA.table)
      .select('*')
      .eq(USUARIO_SCHEMA.columns.telefono, normalized)
      .maybeSingle()

    const row = unwrapSupabaseResult(result, 'Error al buscar usuario por teléfono')
    return mapUsuarioFromRow(row)
  }

  async create(data) {
    const payload = mapUsuarioToRow(data, { isCreate: true })
    const result = await this.client
      .from(USUARIO_SCHEMA.table)
      .insert(payload)
      .select('*')
      .single()

    const row = unwrapSupabaseResult(result, 'Error al crear usuario')
    return mapUsuarioFromRow(row)
  }

  async update(id, data) {
    const numericId = Number(id)
    if (!Number.isInteger(numericId) || numericId <= 0) {
      throw AppError.badRequest('El id de usuario debe ser un entero positivo')
    }

    const payload = mapUsuarioToRow(data)
    if (Object.keys(payload).length === 0) {
      return this.findById(numericId)
    }

    const result = await this.client
      .from(USUARIO_SCHEMA.table)
      .update(payload)
      .eq(USUARIO_SCHEMA.columns.id, numericId)
      .select('*')
      .maybeSingle()

    const row = unwrapSupabaseResult(result, 'Error al actualizar usuario')
    return mapUsuarioFromRow(row)
  }

  async delete(id) {
    const numericId = Number(id)
    if (!Number.isInteger(numericId) || numericId <= 0) {
      throw AppError.badRequest('El id de usuario debe ser un entero positivo')
    }

    const result = await this.client
      .from(USUARIO_SCHEMA.table)
      .delete()
      .eq(USUARIO_SCHEMA.columns.id, numericId)
      .select(USUARIO_SCHEMA.columns.id)

    const rows = unwrapSupabaseResult(result, 'Error al eliminar usuario') || []
    return rows.length > 0
  }

  async verifyCredentials(email, password) {
    const normalized = String(email || '').toLowerCase().trim()
    if (!normalized || !password) return null

    // La tabla public.usuario no almacena contraseña; delegamos en Supabase Auth si está configurado
    if (this.client.auth?.signInWithPassword) {
      const { data, error } = await this.client.auth.signInWithPassword({
        email: normalized,
        password: String(password),
      })

      if (error || !data?.user) {
        return null
      }

      const byAuthId = await this.client
        .from(USUARIO_SCHEMA.table)
        .select('*')
        .eq(USUARIO_SCHEMA.columns.authId, data.user.id)
        .maybeSingle()

      const row = unwrapSupabaseResult(byAuthId, 'Error al obtener perfil de usuario autenticado')
      if (row) return mapUsuarioFromRow(row)
    }

    return this.findByEmail(normalized)
  }

  async solicitarPublicador(usuarioId, motivo) {
    const usuario = await this.findById(usuarioId)
    if (!usuario) return null

    return {
      usuarioId: usuario.id,
      motivo: motivo || 'Solicitud de alta como publicador local',
      estado: 'pendiente',
      fecha: new Date(),
    }
  }

  async findSolicitudesPublicador(_usuarioId) {
    return []
  }
}
