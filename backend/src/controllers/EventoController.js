export class EventoController {
  constructor({ eventoService }) {
    this.eventoService = eventoService
  }

  listar = async (req, res) => {
    const eventos = await this.eventoService.listarEventos(req.query)
    res.status(200).json({
      ok: true,
      data: eventos,
    })
  }

  mapa = async (req, res) => {
    const puntos = await this.eventoService.obtenerMapaEventos(req.query)
    res.status(200).json({
      ok: true,
      data: puntos,
    })
  }

  obtenerPorId = async (req, res) => {
    const evento = await this.eventoService.obtenerEventoPorId(req.params.id)
    res.status(200).json({
      ok: true,
      data: evento,
    })
  }

  crear = async (req, res) => {
    const evento = await this.eventoService.crearEvento(req.body, req.user.id)
    res.status(201).json({
      ok: true,
      message: 'Evento creado correctamente',
      data: evento,
    })
  }

  actualizar = async (req, res) => {
    const evento = await this.eventoService.actualizarEvento(req.params.id, req.body, req.user.id)
    res.status(200).json({
      ok: true,
      message: 'Evento actualizado correctamente',
      data: evento,
    })
  }

  eliminar = async (req, res) => {
    const result = await this.eventoService.eliminarEvento(req.params.id, req.user.id)
    res.status(200).json({
      ok: true,
      message: 'Evento eliminado correctamente',
      data: result,
    })
  }

  terminar = async (req, res) => {
    const evento = await this.eventoService.terminarEvento(req.params.id, req.user.id)
    res.status(200).json({
      ok: true,
      message: 'Evento marcado como terminado. Reseñas habilitadas para los asistentes.',
      data: evento,
    })
  }

  inscribirse = async (req, res) => {
    const result = await this.eventoService.inscribirse(req.params.id, req.user.id)
    res.status(201).json({
      ok: true,
      message: 'Inscripción realizada con éxito',
      data: result,
    })
  }

  desapuntarse = async (req, res) => {
    const result = await this.eventoService.desapuntarse(req.params.id, req.user.id)
    res.status(200).json({
      ok: true,
      message: 'Inscripción cancelada con éxito',
      data: result,
    })
  }

  aprobar = async (req, res) => {
    const evento = await this.eventoService.aprobarEvento(req.params.id, req.body?.motivo)
    res.status(200).json({
      ok: true,
      message: 'Evento aprobado correctamente',
      data: evento,
    })
  }

  denegar = async (req, res) => {
    const evento = await this.eventoService.denegarEvento(req.params.id, req.body?.motivo)
    res.status(200).json({
      ok: true,
      message: 'Evento denegado correctamente',
      data: evento,
    })
  }

  verInscritos = async (req, res) => {
    const result = await this.eventoService.obtenerInscritos(req.params.id, req.user.id)
    res.status(200).json({
      ok: true,
      data: result,
    })
  }

  compartir = async (req, res) => {
    const result = await this.eventoService.compartirEvento(req.params.id)
    res.status(200).json({
      ok: true,
      data: result,
    })
  }
}

