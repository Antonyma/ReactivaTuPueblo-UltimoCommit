export const TELEFONO_BOT_WHATSAPP = "34600112233";

export const municipiosMancomunidad = {
  "Alcudia de Monteagud": [37.2361, -2.2669],
  "Benitagla": [37.2314, -2.2389],
  "Benizalón": [37.2119, -2.2414],
  "Castro de Filabres": [37.1847, -2.4403],
  "Gérgal": [37.1186, -2.5397],
  "Lucainena de las Torres": [37.0412, -2.2015],
  "Olula de Castro": [37.1753, -2.4747],
  "Senés": [37.2045, -2.3468],
  "Sorbas": [37.0983, -2.1239],
  "Tabernas": [37.0500, -2.3911],
  "Tahal": [37.2281, -2.2856],
  "Turrillas": [37.0297, -2.2633],
  "Uleila del Campo": [37.1852, -2.2041],
  "Velefique": [37.1941, -2.4032]
};

export const CENTRO_MANCOMUNIDAD = [37.145, -2.315];
export const ZOOM_MANCOMUNIDAD = 10;

export const coordsPueblos = {
  "Todos": { center: CENTRO_MANCOMUNIDAD, zoom: ZOOM_MANCOMUNIDAD },
  "Lucainena de las Torres": { center: [37.0412, -2.2015], zoom: 14 },
  "Velefique": { center: [37.1941, -2.4032], zoom: 14 },
  "Senés": { center: [37.2045, -2.3468], zoom: 14 },
  "Uleila del Campo": { center: [37.1852, -2.2041], zoom: 14 }
};

export const cuentasNegocioIniciales = {
  "Ayuntamiento de Lucainena": {
    id: 1,
    nombre: "Ayuntamiento de Lucainena",
    esMio: true,
    pueblo: "Lucainena de las Torres",
    telefonoPublicador: "+34611001100",
    actividadesAprobadas: 18,
    cuentaVerificada: true,
    fiabilidad: 3,
    resenas: [
      { usuario: "Carmen L.", estrellas: 5, texto: "Siempre muy bien organizado." },
      { usuario: "Antonio R.", estrellas: 5, texto: "Puntuales y atentos." }
    ]
  },
  "Mesón El Mirador": {
    id: 2,
    nombre: "Mesón El Mirador",
    esMio: true,
    pueblo: "Senés",
    telefonoPublicador: "+34622002200",
    actividadesAprobadas: 5,
    cuentaVerificada: false,
    fiabilidad: 2,
    resenas: [
      { usuario: "Lucía P.", estrellas: 5, texto: "Comida casera riquísima." }
    ]
  },
  "Taller Artesano Uleila (Nuevo)": {
    id: 3,
    nombre: "Taller Artesano Uleila (Nuevo)",
    esMio: true,
    pueblo: "Uleila del Campo",
    telefonoPublicador: "+34633003300",
    actividadesAprobadas: 0,
    cuentaVerificada: false,
    fiabilidad: 1,
    resenas: []
  },
  "Club Deportivo Velefique": {
    id: 4,
    nombre: "Club Deportivo Velefique",
    esMio: false,
    pueblo: "Velefique",
    telefonoPublicador: "+34644004400",
    actividadesAprobadas: 11,
    cuentaVerificada: true,
    fiabilidad: 3,
    resenas: [
      { usuario: "Javier M.", estrellas: 5, texto: "Muy buen ambiente." }
    ]
  }
};

export function evaluarFiabilidadNegocio(nombreNegocio, cuentas = cuentasNegocioIniciales) {
  const info = cuentas[nombreNegocio];
  if (!info) return { nivel: 1, esDeConfianza: false, media: "0.0", motivo: "Cuenta nueva (Nivel 1)" };

  const totalRes = info.resenas.length;
  const mediaNum = totalRes > 0 ? info.resenas.reduce((acc, r) => acc + r.estrellas, 0) / totalRes : 0;

  let nivel = 1;
  if (info.cuentaVerificada && info.actividadesAprobadas >= 8 && mediaNum >= 4.5) {
    nivel = 3;
  } else if (info.actividadesAprobadas >= 2 || (totalRes >= 1 && mediaNum >= 4.0)) {
    nivel = 2;
  }

  const esDeConfianza = nivel >= 2;
  return {
    nivel,
    esDeConfianza,
    media: mediaNum.toFixed(1),
    motivo: esDeConfianza
      ? `Referencia Nivel ${nivel}/3 · Pase directo (0 tokens)`
      : `Referencia Nivel 1/3 · Requiere revisión`
  };
}

export const actividadesIniciales = [
  {
    id: 1,
    nombre: "Paseo Vía Verde y Hornos",
    pueblo: "Lucainena de las Torres",
    negocio: "Ayuntamiento de Lucainena",
    categoria: "Turismo",
    descripcion: "Paseo tranquilo guiado por los hornos históricos. Apto para todas las edades.",
    coords: [37.0412, -2.2015],
    dePago: false,
    asistentes: 18,
    aforo: 30,
    listaInscritos: [{ nombre: "Carmen López", email: "carmen@ejemplo.com", telefono: "+34611002233" }],
    fechaInicioISO: "2026-11-28T09:30",
    fechaFinISO: "2026-11-28T11:30",
    fecha: "Sábado · 09:30h",
    estadoModeracion: "aprobada",
    ahorroTokens: true,
    motivoIA: "Pase directo por Referencia Nivel 3/3 (0 tokens gastados)",
    moderacionImagen: {
      modelo: "gemini-2.5-flash-lite",
      esLlamadaLigera: true,
      tokensGastados: 12,
      motivo: "⚡ Llamada ligera (gemini-2.5-flash-lite): Entidad oficial verificada (Nivel 3/3). Comprobación rápida superada sin alertas."
    },
    imagen: "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: 2,
    nombre: "Fiesta Patronal de San Roque",
    pueblo: "Lucainena de las Torres",
    negocio: "Ayuntamiento de Lucainena",
    categoria: "Fiesta Patronal",
    descripcion: "Procesión, música en la plaza y roscos caseros para todos los vecinos.",
    coords: [37.0432, -2.1982],
    dePago: false,
    asistentes: 85,
    aforo: 150,
    listaInscritos: [{ nombre: "Elena Navarro", email: "elena@ejemplo.com", telefono: "+34633112233" }],
    fechaInicioISO: "2026-11-28T20:30",
    fechaFinISO: "2026-11-28T23:30",
    fecha: "Sábado · 20:30h",
    estadoModeracion: "aprobada",
    ahorroTokens: true,
    motivoIA: "Pase directo por Referencia Nivel 3/3 (0 tokens gastados)",
    imagen: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: 3,
    nombre: "Comida de Migas Serranas",
    pueblo: "Senés",
    negocio: "Mesón El Mirador",
    categoria: "Gastronomía",
    descripcion: "Migas tradicionales hechas en lumbre de leña en la plaza del pueblo.",
    coords: [37.2045, -2.3468],
    dePago: true,
    asistentes: 32,
    aforo: 40,
    listaInscritos: [{ nombre: "Lucía Pérez", email: "lucia@ejemplo.com", telefono: "+34655334455" }],
    fechaInicioISO: "2026-11-29T13:30",
    fechaFinISO: "2026-11-29T16:00",
    fecha: "Domingo · 13:30h",
    estadoModeracion: "aprobada",
    ahorroTokens: true,
    motivoIA: "Pase directo por Referencia Nivel 2/3 (0 tokens gastados)",
    imagen: "https://images.unsplash.com/photo-1515443961218-a51367888e4b?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: 4,
    nombre: "Merienda Vecinal y Taller de Esparto",
    pueblo: "Uleila del Campo",
    negocio: "Taller Artesano Uleila (Nuevo)",
    categoria: "Comercio",
    descripcion: "Taller abierto para aprender a trenzar esparto con merienda tradicional.",
    coords: [37.1852, -2.2041],
    dePago: false,
    asistentes: 0,
    aforo: 25,
    listaInscritos: [],
    fechaInicioISO: "2026-11-29T17:00",
    fechaFinISO: "2026-11-29T19:00",
    fecha: "Domingo · 17:00h",
    estadoModeracion: "pendiente",
    ahorroTokens: false,
    motivoIA: "Cuenta Nivel 1/3 · Esperando validación del Moderador",
    imagen: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: 5,
    nombre: "Anuncio Publicitario Externo Sin Relación",
    pueblo: "Tabernas",
    negocio: "Cuenta Externa",
    categoria: "Comercio",
    descripcion: "Promoción comercial ajena a la comarca con selfie en primer plano.",
    coords: [37.0500, -2.3911],
    dePago: true,
    asistentes: 0,
    aforo: 10,
    listaInscritos: [],
    fechaInicioISO: "2026-11-30T10:00",
    fechaFinISO: "2026-11-30T12:00",
    fecha: "Lunes · 10:00h",
    estadoModeracion: "denegada",
    ahorroTokens: false,
    motivoIA: "Rechazada · Aviso enviado por WhatsApp al publicador",
    imagen: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80"
  }
];

export function formatearTelefonoConPrefijo(rawTel) {
  if (!rawTel) return "";
  const limpio = rawTel.trim().replace(/\s+/g, "");
  if (!limpio) return "";
  if (limpio.startsWith("+34")) return limpio;
  return "+34" + limpio.replace(/^\+/, "");
}

export function formatearFechaBonita(isoStr) {
  if (!isoStr) return "Próximamente";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  return `${dias[d.getDay()]} · ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}h`;
}

export const resenasIniciales = [
  {
    id: 1,
    negocio: "Ayuntamiento de Lucainena",
    usuario: "Carmen L.",
    estrellas: 5,
    texto: "Siempre muy bien organizado y cuidando el patrimonio del pueblo.",
    estado: "aprobada",
    contieneMalasPalabras: false,
    palabrasDetectadas: [],
    motivoIA: "Aprobada por Gemini: Lenguaje respetuoso y constructivo.",
    fecha: "2026-11-20"
  },
  {
    id: 2,
    negocio: "Ayuntamiento de Lucainena",
    usuario: "Antonio R.",
    estrellas: 5,
    texto: "Puntuales y atentos con todos los vecinos y turistas.",
    estado: "aprobada",
    contieneMalasPalabras: false,
    palabrasDetectadas: [],
    motivoIA: "Aprobada por Gemini: Lenguaje respetuoso y constructivo.",
    fecha: "2026-11-20"
  },
  {
    id: 3,
    negocio: "Mesón El Mirador",
    usuario: "Lucía P.",
    estrellas: 5,
    texto: "Comida casera riquísima y trato inmejorable.",
    estado: "aprobada",
    contieneMalasPalabras: false,
    palabrasDetectadas: [],
    motivoIA: "Aprobada por Gemini: Lenguaje respetuoso y constructivo.",
    fecha: "2026-11-20"
  },
  {
    id: 4,
    negocio: "Mesón El Mirador",
    usuario: "Vecino Anónimo",
    estrellas: 1,
    texto: "Vaya una mierda de servicio, el camarero es un sinvergüenza y un estafador.",
    estado: "rechazada",
    contieneMalasPalabras: true,
    palabrasDetectadas: ["mierda", "sinvergüenza", "estafador"],
    motivoIA: "Bloqueada por Gemini: Palabras malsonantes e insultos detectados ('mierda', 'sinvergüenza', 'estafador'). Eliminada de la vista pública.",
    fecha: "2026-11-21"
  }
];
