import { env } from '../config/env.js'
import { AppError } from '../middlewares/errorHandler.js'

const CAMPOS_EDITABLES_NEGOCIO = [
  'nombre',
  'pueblo',
  'coordenadas',
  'instagramUrl',
  'facebookUrl',
  'twitterUrl',
  'webUrl',
]

const ALIAS_URLS_NEGOCIO = {
  instagram: 'instagramUrl',
  facebook: 'facebookUrl',
  twitter: 'twitterUrl',
  web: 'webUrl',
}

const CAMPOS_URL_NEGOCIO = ['instagramUrl', 'facebookUrl', 'twitterUrl', 'webUrl']

function filtrarCamposNegocio(data = {}) {
  const limpio = {}
  for (const [alias, canonico] of Object.entries(ALIAS_URLS_NEGOCIO)) {
    if (data[canonico] === undefined && data[alias] !== undefined) {
      limpio[canonico] = data[alias]
    }
  }
  for (const campo of CAMPOS_EDITABLES_NEGOCIO) {
    if (data[campo] !== undefined) {
      limpio[campo] = data[campo]
    }
  }
  return limpio
}

function validarUrlsSeguras(obj = {}) {
  for (const campo of CAMPOS_URL_NEGOCIO) {
    const val = obj[campo]
    if (!val) continue
    const s = String(val).trim()
    if (/^\s*(javascript|data|vbscript):/i.test(s)) {
      throw AppError.badRequest(`La URL de ${campo} no tiene un esquema permitido`)
    }
  }
}

async function moderarNegocioConIa(campos = {}) {
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (env.aiAgentsApiKey) {
      headers['X-API-Key'] = env.aiAgentsApiKey
    }
    const redes = [campos.instagramUrl, campos.facebookUrl, campos.twitterUrl, campos.webUrl]
      .filter(Boolean)
      .join(' ')
    const descripcion = [
      campos.pueblo ? `Comercio local en ${campos.pueblo}.` : 'Comercio local.',
      redes ? `Redes/Web: ${redes}` : '',
    ]
      .filter(Boolean)
      .join(' ')

    const res = await fetch(`${env.aiAgentsUrl}/agents/moderate/event-title`, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({
        titulo: campos.nombre,
        descripcion,
        categoria: 'Comercio',
      }),
    })
    if (!res.ok) {
      return null
    }
    return await res.json()
  } catch {
    return null
  }
}

export class NegocioService {
  constructor({ negocioRepository }) {
    this.negocioRepository = negocioRepository
  }

  async listarNegocios(filters = {}) {
    if (filters.propietarioId !== undefined && filters.propietarioId !== '') {
      return this.negocioRepository.findByPropietarioId(filters.propietarioId)
    }
    return this.negocioRepository.findAll()
  }

  async obtenerNegocioPorId(negocioId) {
    const negocio = await this.negocioRepository.findById(negocioId)
    if (!negocio) {
      throw AppError.notFound('Negocio no encontrado')
    }
    return negocio
  }

  async crearNegocio(data, propietarioId) {
    const camposLimpios = filtrarCamposNegocio(data)
    validarUrlsSeguras(camposLimpios)

    const resIa = await moderarNegocioConIa(camposLimpios)
    if (resIa) {
      const tieneFalta =
        Boolean(resIa.contiene_palabras_malsonantes) ||
        Boolean(resIa.contiene_amenazas_o_violencia)
      if (tieneFalta || resIa.aprobada === false) {
        throw AppError.badRequest(
          resIa.motivo || 'El comercio no supera el filtro de moderación.'
        )
      }
    }

    // Siempre queda pendiente (fiabilidad: 0) hasta que un administrador humano lo apruebe
    return this.negocioRepository.create({
      ...camposLimpios,
      fiabilidad: 0,
      propietarioId: Number(propietarioId),
      propietario: { id: Number(propietarioId) },
    })
  }

  async aprobarNegocio(negocioId) {
    const negocio = await this.obtenerNegocioPorId(negocioId)
    const nuevaFiabilidad = Math.max(40, Number(negocio.fiabilidad || 0))
    return this.negocioRepository.update(negocioId, { fiabilidad: nuevaFiabilidad })
  }

  async denegarNegocio(negocioId) {
    await this.obtenerNegocioPorId(negocioId)
    await this.negocioRepository.delete(negocioId)
    return { deleted: true, negocioId: Number(negocioId) }
  }

  async actualizarNegocio(negocioId, data, propietarioId) {
    const negocio = await this.obtenerNegocioPorId(negocioId)
    if (negocio.propietario?.id !== Number(propietarioId)) {
      throw AppError.forbidden('Solo el propietario del negocio puede modificarlo')
    }

    const camposLimpios = filtrarCamposNegocio(data)
    validarUrlsSeguras(camposLimpios)
    return this.negocioRepository.update(negocioId, camposLimpios)
  }

  async eliminarNegocio(negocioId, propietarioId) {
    const negocio = await this.obtenerNegocioPorId(negocioId)
    if (negocio.propietario?.id !== Number(propietarioId)) {
      throw AppError.forbidden('Solo el propietario del negocio puede eliminarlo')
    }

    await this.negocioRepository.delete(negocioId)
    return { deleted: true, negocioId: Number(negocioId) }
  }

  async actualizarRedesSociales(negocioId, propietarioId, redes) {
    const negocio = await this.obtenerNegocioPorId(negocioId)
    if (negocio.propietario?.id !== Number(propietarioId)) {
      throw AppError.forbidden('Solo el propietario del negocio puede actualizar sus redes sociales')
    }

    validarUrlsSeguras(redes)
    return this.negocioRepository.updateRedesSociales(negocioId, redes)
  }
}
