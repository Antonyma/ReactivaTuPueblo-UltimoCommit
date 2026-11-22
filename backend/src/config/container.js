import { AuthController } from '../controllers/AuthController.js'
import { EventoController } from '../controllers/EventoController.js'
import { IaController } from '../controllers/IaController.js'
import { ImagenController } from '../controllers/ImagenController.js'
import { NegocioController } from '../controllers/NegocioController.js'
import { UsuarioController } from '../controllers/UsuarioController.js'
import { ValoracionController } from '../controllers/ValoracionController.js'
import { WhatsappController } from '../controllers/WhatsappController.js'
import { createAuthMiddleware, createOptionalAuthMiddleware } from '../middlewares/authMiddleware.js'
import { createInitialMockStore } from '../repositories/mock/mockData.js'
import { MockEventoRepository } from '../repositories/mock/MockEventoRepository.js'
import { MockImagenRepository } from '../repositories/mock/MockImagenRepository.js'
import { MockNegocioRepository } from '../repositories/mock/MockNegocioRepository.js'
import { MockUsuarioRepository } from '../repositories/mock/MockUsuarioRepository.js'
import { MockValoracionRepository } from '../repositories/mock/MockValoracionRepository.js'
import { SupabaseEventoRepository } from '../repositories/supabase/SupabaseEventoRepository.js'
import { SupabaseImagenRepository } from '../repositories/supabase/SupabaseImagenRepository.js'
import { SupabaseNegocioRepository } from '../repositories/supabase/SupabaseNegocioRepository.js'
import { SupabaseUsuarioRepository } from '../repositories/supabase/SupabaseUsuarioRepository.js'
import { SupabaseValoracionRepository } from '../repositories/supabase/SupabaseValoracionRepository.js'
import { AuthService } from '../services/AuthService.js'
import { EventoService } from '../services/EventoService.js'
import { IaService } from '../services/IaService.js'
import { ImagenService } from '../services/ImagenService.js'
import { NegocioService } from '../services/NegocioService.js'
import { SocialScraperService } from '../services/SocialScraperService.js'
import { UsuarioService } from '../services/UsuarioService.js'
import { ValoracionService } from '../services/ValoracionService.js'
import { WhatsappService } from '../services/WhatsappService.js'
import { env } from './env.js'
import { createSupabaseClient } from './supabaseClient.js'

function buildRepositories() {
  if (env.dataSource === 'supabase') {
    const supabaseClient = createSupabaseClient()
    return {
      supabaseClient,
      usuarioRepository: new SupabaseUsuarioRepository(supabaseClient),
      negocioRepository: new SupabaseNegocioRepository(supabaseClient),
      eventoRepository: new SupabaseEventoRepository(supabaseClient),
      valoracionRepository: new SupabaseValoracionRepository(supabaseClient),
      imagenRepository: new SupabaseImagenRepository(supabaseClient),
    }
  }

  if (env.dataSource === 'mock') {
    const mockStore = createInitialMockStore()
    return {
      supabaseClient: null,
      usuarioRepository: new MockUsuarioRepository(mockStore),
      negocioRepository: new MockNegocioRepository(mockStore),
      eventoRepository: new MockEventoRepository(mockStore),
      valoracionRepository: new MockValoracionRepository(mockStore),
      imagenRepository: new MockImagenRepository(mockStore),
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
  const { supabaseClient, ...repositories } = buildRepositories()

  const {
    usuarioRepository,
    negocioRepository,
    eventoRepository,
    valoracionRepository,
    imagenRepository,
  } = repositories

  const authService = new AuthService({ usuarioRepository })
  const usuarioService = new UsuarioService({ usuarioRepository, eventoRepository })
  const negocioService = new NegocioService({ negocioRepository })
  const eventoService = new EventoService({
    eventoRepository,
    negocioRepository,
    valoracionRepository,
  })
  const valoracionService = new ValoracionService({ valoracionRepository, eventoRepository })
  const imagenService = new ImagenService({ imagenRepository, eventoRepository })
  const iaService = new IaService({ eventoRepository, usuarioRepository })
  const socialScraperService = new SocialScraperService({
    negocioRepository,
    eventoRepository,
  })
  const whatsappService = new WhatsappService({
    usuarioRepository,
    eventoRepository,
    iaService,
    eventoService,
    negocioRepository,
  })

  const controllers = {
    authController: new AuthController({ authService }),
    usuarioController: new UsuarioController({ usuarioService }),
    negocioController: new NegocioController({
      negocioService,
      valoracionService,
      socialScraperService,
    }),
    eventoController: new EventoController({ eventoService }),
    valoracionController: new ValoracionController({ valoracionService }),
    imagenController: new ImagenController({ imagenService }),
    iaController: new IaController({ iaService }),
    whatsappController: new WhatsappController({ whatsappService }),
  }

  const middlewares = {
    requireAuth: createAuthMiddleware(repositories.usuarioRepository, supabaseClient),
    optionalAuth: createOptionalAuthMiddleware(repositories.usuarioRepository, supabaseClient),
  }

  return {
    repositories,
    services: {
      authService,
      usuarioService,
      negocioService,
      eventoService,
      valoracionService,
      imagenService,
      iaService,
      socialScraperService,
      whatsappService,
    },
    controllers,
    middlewares,
  }
}
