export class Valoracion {
  /**
   * @param {Object} params
   * @param {number} params.id
   * @param {import('./Usuario.js').Usuario} params.usuario
   * @param {import('./Evento.js').Evento} params.evento
   * @param {string} params.texto
   * @param {number} params.estrellas
   * @param {Date|string} [params.fecha]
   */
  constructor({ id, usuario, evento, texto, estrellas, fecha = new Date() }) {
    this.id = Number(id)
    this.usuario = usuario
    this.evento = evento
    this.texto = String(texto)
    this.estrellas = Number(estrellas)
    this.fecha = fecha instanceof Date ? fecha : new Date(fecha)
  }
}

