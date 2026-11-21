import { AppError } from '../middlewares/errorHandler.js'

export class NegocioService {
  constructor({ negocioRepository }) {
    this.negocioRepository = negocioRepository
  }

  async actualizarRedesSociales(negocioId, propietarioId, redes) {
    const negocio = await this.negocioRepository.findById(negocioId)
    if (!negocio) {
      throw AppError.notFound('Negocio no encontrado')
    }

    if (negocio.propietario?.id !== Number(propietarioId)) {
      throw AppError.forbidden('Solo el propietario del negocio puede actualizar sus redes sociales')
    }

    return this.negocioRepository.updateRedesSociales(negocioId, redes)
  }
}

