import { AppError } from '../../middlewares/errorHandler.js'
import { createSupabaseAuthClient } from '../../config/supabaseClient.js'
import { USUARIOS, Usuario } from '../../models/index.js'
import { UsuarioRepository } from '../contracts/UsuarioRepository.js'
import { assertPositiveInt, escapeIlike, unwrapSupabaseResult } from './supabaseHelpers.js'

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
  MODERADOR: USUARIOS.MODERADOR,
}

const JS_ROLE_TO_DB = {
  [USUARIOS.NO_REGISTRADO]: 'NO_REGISTRADO',
  [USUARIOS.REGISTRADO]: 'REGISTRADO',
  [USUARIOS.PUBLICADOR]: 'PUBLICADOR',
  [USUARIOS.MODERADOR]: 'MODERADOR',
  NO_REGISTRADO: 'NO_REGISTRADO',
  REGISTRADO: 'REGISTRADO',
  PUBLICADOR: 'PUBLICADOR',
  MODERADOR: 'MODERADOR',
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
    const numericId = assertPositiveInt(id, 'usuario')

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
      .ilike(USUARIO_SCHEMA.columns.email, escapeIlike(normalized))
      .maybeSingle()

    const row = unwrapSupabaseResult(result, 'Error al buscar usuario por email')
    return mapUsuarioFromRow(row)
  }

  async findByNombre(nombre) {
    const normalized = String(nombre || '').trim()
    if (!normalized) return null

    const result = await this.client
      .from(USUARIO_SCHEMA.table)
      .select('*')
      .ilike(USUARIO_SCHEMA.columns.nombre, escapeIlike(normalized))
      .maybeSingle()

    const row = unwrapSupabaseResult(result, 'Error al buscar usuario por nombre')
    return mapUsuarioFromRow(row)
  }

  async findByAuthId(authId) {
    if (!authId) return null

    const result = await this.client
      .from(USUARIO_SCHEMA.table)
      .select('*')
      .eq(USUARIO_SCHEMA.columns.authId, String(authId))
      .maybeSingle()

    const row = unwrapSupabaseResult(result, 'Error al buscar usuario por auth_id')
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

  async findByTipoUsuario(tipoUsuario) {
    const dbRole = JS_ROLE_TO_DB[tipoUsuario]
    if (!dbRole) return []

    const result = await this.client
      .from(USUARIO_SCHEMA.table)
      .select('*')
      .eq(USUARIO_SCHEMA.columns.tipoUsuario, dbRole)
      .order(USUARIO_SCHEMA.columns.id, { ascending: true })

    const rows = unwrapSupabaseResult(result, 'Error al listar usuarios por rol') || []
    return rows.map(mapUsuarioFromRow)
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

  async registerWithAuth({ nombre, email, telefono, password, tipoUsuario = USUARIOS.REGISTRADO }) {
    const normalizedEmail = String(email || '').toLowerCase().trim()
    const cleanNombre = String(nombre || '').trim()
    let authId = null

    const authClient = this.client.auth?.signUp || this.client.auth?.signInWithPassword
      ? createSupabaseAuthClient()
      : null

    if (this.client.auth?.admin?.createUser) {
      const { data: adminData, error: adminErr } = await this.client.auth.admin.createUser({
        email: normalizedEmail,
        password: String(password),
        email_confirm: true,
        user_metadata: { nombre: cleanNombre, telefono: String(telefono || '') },
      })
      if (adminErr) {
        throw AppError.badRequest(adminErr.message || 'Error al registrar usuario en Supabase Auth')
      }
      authId = adminData?.user?.id || null
    } else if (authClient?.auth?.signUp) {
      const { data: signUpData, error: signUpErr } = await authClient.auth.signUp({
        email: normalizedEmail,
        password: String(password),
        options: { data: { nombre: cleanNombre, telefono: String(telefono || '') } },
      })
      if (signUpErr) {
        throw AppError.badRequest(signUpErr.message || 'Error al registrar usuario en Supabase Auth')
      }
      authId = signUpData?.user?.id || null
    }

    let usuario
    try {
      usuario = await this.create({
        authId,
        nombre: cleanNombre,
        email: normalizedEmail,
        telefono,
        tipoUsuario,
      })
    } catch (err) {
      if (authId && this.client.auth?.admin?.deleteUser) {
        await this.client.auth.admin.deleteUser(authId).catch((rollbackErr) => {
          console.error('[SupabaseUsuarioRepository] Error al hacer rollback en Auth:', rollbackErr)
        })
      }
      throw err
    }

    let token = null
    if (authClient?.auth?.signInWithPassword) {
      const { data: signInData } = await authClient.auth.signInWithPassword({
        email: normalizedEmail,
        password: String(password),
      })
      token = signInData?.session?.access_token || null
    }

    return { usuario, token }
  }

  async loginWithNombre(nombre, password) {
    const cleanInput = String(nombre || '').trim()
    if (!cleanInput || !password) return null

    let usuarioPorNombre = await this.findByNombre(cleanInput)
    if (!usuarioPorNombre && cleanInput.includes('@')) {
      usuarioPorNombre = await this.findByEmail(cleanInput)
    }
    if (!usuarioPorNombre || !usuarioPorNombre.email) {
      return null
    }

    const authClient = this.client.auth?.signInWithPassword ? createSupabaseAuthClient() : null
    if (authClient?.auth?.signInWithPassword) {
      const { data, error } = await authClient.auth.signInWithPassword({
        email: usuarioPorNombre.email,
        password: String(password),
      })

      if (error || !data?.user || !data?.session?.access_token) {
        return null
      }

      const usuario = (await this.findByAuthId(data.user.id)) || usuarioPorNombre
      return {
        usuario,
        token: data.session.access_token,
      }
    }

    return null
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
