import { Evento, Imagen, Negocio, USUARIOS, Usuario, Valoracion } from '../../models/index.js'

export function createInitialMockStore() {
  const usuarios = [
    new Usuario({
      id: 1,
      nombre: 'Laura Gómez',
      email: 'laura@pueblovivo.es',
      telefono: '+34611223344',
      tipoUsuario: USUARIOS.REGISTRADO,
    }),
    new Usuario({
      id: 2,
      nombre: 'Carlos Mendoza',
      email: 'carlos@tahonarural.es',
      telefono: '+34622334455',
      tipoUsuario: USUARIOS.PUBLICADOR,
    }),
    new Usuario({
      id: 3,
      nombre: 'Elena Ruiz',
      email: 'elena@bodegaelena.es',
      telefono: '+34633445566',
      tipoUsuario: USUARIOS.PUBLICADOR,
    }),
    new Usuario({
      id: 4,
      nombre: 'Visitante Invitado',
      email: 'invitado@pueblovivo.es',
      telefono: '+34644556677',
      tipoUsuario: USUARIOS.NO_REGISTRADO,
    }),
    new Usuario({
      id: 5,
      nombre: 'admin',
      email: 'admin@pueblovivo.es',
      telefono: '+34600000000',
      tipoUsuario: USUARIOS.MODERADOR,
    }),
  ]

  const negocios = [
    new Negocio({
      id: 1,
      nombre: 'Tahona Artesanal La Espiga',
      propietario: usuarios[1],
      coordenadas: '40.9651,-5.6639',
      instagramUrl: 'https://instagram.com/tahonaespiga',
      facebookUrl: 'https://facebook.com/tahonaespiga',
      twitterUrl: 'https://x.com/tahonaespiga',
      webUrl: 'https://tahonaespiga.es',
      fiabilidad: 98,
    }),
    new Negocio({
      id: 2,
      nombre: 'Bodega Sierra Alta',
      propietario: usuarios[2],
      coordenadas: '40.9712,-5.6580',
      instagramUrl: 'https://instagram.com/bodegasierraalta',
      facebookUrl: '',
      twitterUrl: 'https://x.com/bodegasierraalta',
      webUrl: 'https://bodegasierraalta.es',
      fiabilidad: 95,
    }),
  ]

  const eventos = [
    new Evento({
      id: 1,
      nombre: 'Taller de Pan Masa Madre',
      negocio: negocios[0],
      descripcion:
        'Aprende a elaborar pan tradicional en horno de leña con harinas locales molidas a la piedra.',
      coordenadas: '40.9651,-5.6639',
      dePago: true,
      asistentes: 1,
      aforo: 15,
      tipoEvento: 1,
      imagen: 'https://images.unsplash.com/photo-1509440159596-0249088772ff',
      fechaInicio: new Date('2026-11-28T10:00:00Z'),
      fechaFin: new Date('2026-11-28T13:00:00Z'),
    }),
    new Evento({
      id: 2,
      nombre: 'Cata de Vinos de Otoño',
      negocio: negocios[1],
      descripcion:
        'Degustación guiada de 4 vinos de parcela acompañada de quesos artesanales de la comarca.',
      coordenadas: '40.9712,-5.6580',
      dePago: true,
      asistentes: 1,
      aforo: 25,
      tipoEvento: 2,
      imagen: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3',
      fechaInicio: new Date('2026-11-29T18:30:00Z'),
      fechaFin: new Date('2026-11-29T20:30:00Z'),
    }),
    new Evento({
      id: 3,
      nombre: 'Ruta Botánica y Senderismo al Mirador',
      negocio: negocios[0],
      descripcion:
        'Paseo interpretativo gratuito por los senderos del pueblo para conocer la flora autóctona.',
      coordenadas: '40.9685,-5.6710',
      dePago: false,
      asistentes: 0,
      aforo: 30,
      tipoEvento: 3,
      imagen: 'https://images.unsplash.com/photo-1551632811-561732d1e306',
      fechaInicio: new Date('2026-12-05T09:30:00Z'),
      fechaFin: new Date('2026-12-05T12:30:00Z'),
    }),
  ]

  const imagenes = [
    new Imagen({
      id: 1,
      imagen: eventos[0].imagen,
      publicador: usuarios[1],
      evento: eventos[0],
    }),
  ]

  const valoraciones = [
    new Valoracion({
      id: 1,
      usuario: usuarios[0],
      evento: eventos[0],
      texto: 'Experiencia increíble, el pan recién salido del horno espectacular.',
      estrellas: 5,
      fecha: new Date('2026-11-15T14:00:00Z'),
    }),
  ]

  // Registro en memoria de inscripciones { eventoId, usuarioId, fechaInscripcion, confirmadaPorWhatsapp }
  const inscripciones = [
    {
      eventoId: 1,
      usuarioId: 1,
      fechaInscripcion: new Date('2026-11-18T11:00:00Z'),
      confirmadaPorWhatsapp: true,
    },
    {
      eventoId: 2,
      usuarioId: 1,
      fechaInscripcion: new Date('2026-11-19T16:20:00Z'),
      confirmadaPorWhatsapp: false,
    },
  ]

  // Credenciales mock simples (email -> password) para login realista en memoria
  const credenciales = new Map([
    ['laura@pueblovivo.es', '123456'],
    ['carlos@tahonarural.es', '123456'],
    ['elena@bodegaelena.es', '123456'],
    ['invitado@pueblovivo.es', '123456'],
    ['admin@pueblovivo.es', 'admin123'],
  ])

  const solicitudesPublicador = []
  const publicacionesWhatsapp = new Map([
    [1, { confirmada: true, fechaConfirmacion: new Date('2026-11-18T09:00:00Z') }],
    [2, { confirmada: true, fechaConfirmacion: new Date('2026-11-19T10:00:00Z') }],
    [3, { confirmada: false, fechaConfirmacion: null }],
  ])

  return {
    usuarios,
    negocios,
    eventos,
    imagenes,
    valoraciones,
    inscripciones,
    credenciales,
    solicitudesPublicador,
    publicacionesWhatsapp,
  }
}

