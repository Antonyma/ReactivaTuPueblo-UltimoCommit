export const USUARIOS = Object.freeze({
  NO_REGISTRADO: 'no registrado',
  REGISTRADO: 'registrado',
  PUBLICADOR: 'publicador',
  MODERADOR: 'moderador',
})

export class Usuario {
  /**
   * @param {Object} params
   * @param {number} params.id
   * @param {string} params.nombre
   * @param {string} params.email
   * @param {string} params.telefono
   * @param {'no registrado'|'registrado'|'publicador'} [params.tipoUsuario]
   */
  constructor({ id, nombre, email, telefono, tipoUsuario = USUARIOS.NO_REGISTRADO }) {
    this.id = Number(id)
    this.nombre = String(nombre)
    this.email = String(email)
    this.telefono = String(telefono)
    this.tipoUsuario = tipoUsuario
  }
}

