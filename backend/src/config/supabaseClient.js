import { createClient } from '@supabase/supabase-js'
import { env } from './env.js'

/**
 * Crea y valida el cliente de Supabase para el backend.
 * Lanza un error claro si faltan variables obligatorias cuando DATA_SOURCE=supabase.
 */
export function createSupabaseClient() {
  const missing = []
  if (!env.supabase.url) {
    missing.push('SUPABASE_URL')
  }
  if (!env.supabase.key) {
    missing.push('SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_ANON_KEY)')
  }

  if (missing.length > 0) {
    throw new Error(
      `Configuración de Supabase incompleta para DATA_SOURCE=${env.dataSource}. ` +
        `Faltan las siguientes variables de entorno: ${missing.join(', ')}`
    )
  }

  return createClient(env.supabase.url, env.supabase.key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
