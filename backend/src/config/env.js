import 'dotenv/config'

const dataSource = (process.env.DATA_SOURCE || 'mock').trim().toLowerCase()
const supabaseUrl = (process.env.SUPABASE_URL || '').trim()
const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || '').trim()
const supabaseServiceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

export const env = {
  port: Number(process.env.PORT) || 3000,
  dataSource,
  aiAgentsUrl: (process.env.AI_AGENTS_URL || 'http://localhost:8000').trim(),
  supabase: {
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
    serviceRoleKey: supabaseServiceRoleKey,
    // En backend priorizamos service_role para operar de forma segura sin depender de RLS de cliente
    key: supabaseServiceRoleKey || supabaseAnonKey,
  },
  whatsapp: {
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'dev_whatsapp_token',
  },
}
