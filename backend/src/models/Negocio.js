export class Negocio {
  /**
   * @param {Object} params
   * @param {number} params.id
   * @param {string} params.nombre
   * @param {import('./Usuario.js').Usuario} params.propietario
   * @param {string} params.coordenadas
   * @param {string} [params.instagramUrl]
   * @param {string} [params.facebookUrl]
   * @param {string} [params.twitterUrl]
   * @param {string} [params.webUrl]
   * @param {number} [params.fiabilidad]
   */
  constructor({
    id,
    nombre,
    propietario,
    coordenadas,
    instagramUrl = '',
    facebookUrl = '',
    twitterUrl = '',
    webUrl = '',
    fiabilidad = 100,
  }) {
    this.id = Number(id)
    this.nombre = String(nombre)
    this.propietario = propietario
    this.coordenadas = String(coordenadas)
    this.instagramUrl = String(instagramUrl)
    this.facebookUrl = String(facebookUrl)
    this.twitterUrl = String(twitterUrl)
    this.webUrl = String(webUrl)
    this.fiabilidad = Number(fiabilidad)
  }
}

