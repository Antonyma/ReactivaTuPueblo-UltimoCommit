import { AuthController } from '../controllers/AuthController.js'
import { EventoController } from '../controllers/EventoController.js'
import { IaController } from '../controllers/IaController.js'
import { NegocioController } from '../controllers/NegocioController.js'
import { UsuarioController } from '../controllers/UsuarioController.js'
import { WhatsappController } from '../controllers/WhatsappController.js'
import { createAuthMiddleware, createOptionalAuthMiddleware } from '../middlewares/authMiddleware.js'
import { createInitialMockStore } from '../repositories/mock/mockData.js'
import { MockEventoRepository } from '../repositories/mock/MockEventoRepository.js'
import { MockNegocioRepository } from '../repositories/mock/MockNegocioRepository.js'
import { MockUsuarioRepository } from '../repositories/mock/MockUsuarioRepository.js'
import { SupabaseEventoRepository } from '../repositories/supabase/SupabaseEventoRepository.js'
import { SupabaseNegocioRepository } from '../repositories/supabase/SupabaseNegocioRepository.js'
import { SupabaseUsuarioRepository } from '../repositories/supabase/SupabaseUsuarioRepository.js'
import { AuthService } from '../services/AuthService.js'
import { EventoService } from '../services/EventoService.js'
import { IaService } from '../services/IaService.js'
import { NegocioService } from '../services/NegocioService.js'
import { UsuarioService } from '../services/UsuarioService.js'
import { WhatsappService } from '../services/WhatsappService.js'
import { env } from './env.js'
import { createSupabaseClient } from './supabaseClient.js'

function buildRepositories() {
  if (env.dataSource === 'supabase') {
    const supabaseClient = createSupabaseClient()
    return {
      usuarioRepository: new SupabaseUsuarioRepository(supabaseClient),
      negocioRepository: new SupabaseNegocioRepository(supabaseClient),
      eventoRepository: new SupabaseEventoRepository(supabaseClient),
    }
  }

  if (env.dataSource === 'mock') {
    const mockStore = createInitialMockStore()
    return {
      usuarioRepository: new MockUsuarioRepository(mockStore),
      negocioRepository: new MockNegocioRepository(mockStore),
      eventoRepository: new MockEventoRepository(mockStore),
    }
  }

  throw new Error(
    `DATA_SOURCE no soportado: "${env.dataSource}". Valores válidos: "mock" o "supabase".`
  )
}

/**
 * Composition Root (DIP): ensambla repositorios -> servicios -> controladores -> middlewares.
 */
export function createContainer() {
  const repositories = buildRepositories()

  const authService = new AuthService(repositories)
  const usuarioService = new UsuarioService(repositories)
  const negocioService = new NegocioService(repositories)
  const eventoService = new EventoService(repositories)
  const iaService = new IaService(repositories)
  const whatsappService = new WhatsappService({ ...repositories, iaService })

  const controllers = {
    authController: new AuthController({ authService }),
    usuarioController: new UsuarioController({ usuarioService }),
    negocioController: new NegocioController({ negocioService }),
    eventoController: new EventoController({ eventoService }),
    iaController: new IaController({ iaService }),
    whatsappController: new WhatsappController({ whatsappService }),
  }

  const middlewares = {
    requireAuth: createAuthMiddleware(repositories.usuarioRepository),
    optionalAuth: createOptionalAuthMiddleware(repositories.usuarioRepository),
  }

  return {
    repositories,
    services: {
      authService,
      usuarioService,
      negocioService,
      eventoService,
      iaService,
      whatsappService,
    },
    controllers,
    middlewares,
  }
}

