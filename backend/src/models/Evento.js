export class Evento {
  /**
   * @param {Object} params
   * @param {number} params.id
   * @param {string} params.nombre
   * @param {import('./Negocio.js').Negocio} params.negocio
   * @param {string} params.descripcion
   * @param {string} params.coordenadas
   * @param {boolean} [params.dePago]
   * @param {number} [params.asistentes]
   * @param {number} params.aforo
   * @param {number} params.tipoEvento
   * @param {string} [params.imagen]
   * @param {Date|string} params.fechaInicio
   * @param {Date|string} params.fechaFin
   */
  constructor({
    id,
    nombre,
    negocio,
    descripcion,
    coordenadas,
    dePago = false,
    asistentes = 0,
    aforo,
    tipoEvento,
    imagen = '',
    fechaInicio,
    fechaFin,
    pueblo = '',
    estado = 'pendiente',
    motivo = '',
    urlPost = '',
  }) {
    this.id = Number(id)
    this.nombre = String(nombre)
    this.negocio = negocio
    this.descripcion = String(descripcion)
    this.coordenadas = String(coordenadas)
    this.dePago = Boolean(dePago)
    this.asistentes = Number(asistentes)
    this.aforo = Number(aforo)
    this.tipoEvento = Number(tipoEvento)
    this.imagen = String(imagen)
    this.fechaInicio = fechaInicio instanceof Date ? fechaInicio : new Date(fechaInicio)
    this.fechaFin = fechaFin instanceof Date ? fechaFin : new Date(fechaFin)
    this.pueblo = String(pueblo)
    this.estado = String(estado || 'pendiente')
    this.motivo = String(motivo || '')
    this.urlPost = String(urlPost || '')
  }
}

