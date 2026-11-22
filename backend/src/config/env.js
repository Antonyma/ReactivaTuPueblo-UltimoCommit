import 'dotenv/config'

const dataSource = (process.env.DATA_SOURCE || 'mock').trim().toLowerCase()
const supabaseUrl = (process.env.SUPABASE_URL || '').trim()
const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || '').trim()
const supabaseServiceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
const rawCorsOrigins = (process.env.CORS_ORIGINS || '').trim()

export const env = {
  nodeEnv: (process.env.NODE_ENV || 'development').trim().toLowerCase(),
  port: Number(process.env.PORT) || 3000,
  dataSource,
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:5173').trim().replace(/\/+$/, ''),
  corsOrigins: rawCorsOrigins
    ? rawCorsOrigins.split(',').map((o) => o.trim()).filter(Boolean)
    : [],
  aiAgentsUrl: (process.env.AI_AGENTS_URL || 'http://localhost:8000').trim().replace(/\/+$/, ''),
  aiAgentsApiKey: (process.env.AI_AGENTS_API_KEY || '').trim(),
  supabase: {
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
    serviceRoleKey: supabaseServiceRoleKey,
    // En backend priorizamos service_role para operar de forma segura sin depender de RLS de cliente
    key: supabaseServiceRoleKey || supabaseAnonKey,
  },
  whatsapp: {
    verifyToken: (process.env.WHATSAPP_VERIFY_TOKEN || '').trim(),
  },
  n8n: {
    notifyEventChangeUrl: (process.env.N8N_NOTIFY_EVENT_CHANGE_URL || '').trim(),
    notifyBusinessUrl: (process.env.N8N_NOTIFY_BUSINESS_URL || '').trim(),
  },
}
