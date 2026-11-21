import { AppError } from '../middlewares/errorHandler.js'

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
    return this.negocioRepository.create({
      ...data,
      propietarioId: Number(propietarioId),
      propietario: { id: Number(propietarioId) },
    })
  }

  async actualizarNegocio(negocioId, data, propietarioId) {
    const negocio = await this.obtenerNegocioPorId(negocioId)
    if (negocio.propietario?.id !== Number(propietarioId)) {
      throw AppError.forbidden('Solo el propietario del negocio puede modificarlo')
    }

    return this.negocioRepository.update(negocioId, data)
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

    return this.negocioRepository.updateRedesSociales(negocioId, redes)
  }
}
