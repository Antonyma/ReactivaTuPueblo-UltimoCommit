export class Imagen {
  /**
   * @param {Object} params
   * @param {number} params.id
   * @param {string} params.imagen
   * @param {import('./Usuario.js').Usuario} params.publicador
   * @param {import('./Evento.js').Evento} params.evento
   */
  constructor({ id, imagen, publicador, evento }) {
    this.id = Number(id)
    this.imagen = String(imagen)
    this.publicador = publicador
    this.evento = evento
  }
}

