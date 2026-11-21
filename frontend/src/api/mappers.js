import {
  CENTRO_MANCOMUNIDAD,
  TIPO_EVENTO_A_CATEGORIA,
  formatearFechaBonita,
  municipiosMancomunidad,
} from "../constants/comarca.js";

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=800&q=80";

export function parseCoords(coordenadasStr, puebloFallback) {
  if (Array.isArray(coordenadasStr) && coordenadasStr.length === 2) {
    return [Number(coordenadasStr[0]), Number(coordenadasStr[1])];
  }
  if (typeof coordenadasStr === "string" && coordenadasStr.includes(",")) {
    const parts = coordenadasStr.split(",").map((s) => Number(s.trim()));
    if (parts.length === 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
      return parts;
    }
  }
  if (puebloFallback && municipiosMancomunidad[puebloFallback]) {
    return municipiosMancomunidad[puebloFallback];
  }
  return CENTRO_MANCOMUNIDAD;
}

export function normalizeRoleForUi(tipoUsuario) {
  if (!tipoUsuario) return "REGISTRADO";
  const upper = String(tipoUsuario).toUpperCase().trim();
  if (upper.includes("MODERADOR")) return "MODERADOR";
  if (upper.includes("PUBLICADOR")) return "PUBLICADOR";
  return "REGISTRADO";
}

export function normalizeRoleForApi(tipoUsuario) {
  const upper = String(tipoUsuario || "").toUpperCase().trim();
  if (upper === "MODERADOR") return "moderador";
  if (upper === "PUBLICADOR") return "publicador";
  return "registrado";
}

function toDatetimeLocalInput(isoVal) {
  if (!isoVal) return "";
  const d = new Date(isoVal);
  if (Number.isNaN(d.getTime())) return String(isoVal).slice(0, 16);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function mapEventoFromApi(ev) {
  const negocioNombre = ev.negocio?.nombre || "Organizador local";
  const pueblo = ev.pueblo || ev.negocio?.pueblo || "Lucainena de las Torres";
  const fechaInicioISO = toDatetimeLocalInput(ev.fechaInicio);
  const fechaFinISO = toDatetimeLocalInput(ev.fechaFin);

  return {
    id: Number(ev.id),
    nombre: ev.nombre,
    pueblo,
    negocio: negocioNombre,
    negocioId: ev.negocio?.id ? Number(ev.negocio.id) : null,
    categoria: TIPO_EVENTO_A_CATEGORIA[Number(ev.tipoEvento)] || "Cultura",
    tipoEvento: Number(ev.tipoEvento || 1),
    descripcion: ev.descripcion || "",
    coords: parseCoords(ev.coordenadas, pueblo),
    dePago: Boolean(ev.dePago),
    asistentes: Number(ev.asistentes ?? 0),
    aforo: Number(ev.aforo ?? 0),
    listaInscritos: Array.isArray(ev.listaInscritos) ? ev.listaInscritos : [],
    fechaInicioISO,
    fechaFinISO,
    fecha: formatearFechaBonita(ev.fechaInicio),
    estadoModeracion: String(ev.estado || "aprobada").trim().toLowerCase(),
    ahorroTokens: Number(ev.negocio?.fiabilidad ?? 0) >= 60,
    motivoIA: ev.motivo || "",
    imagen: ev.imagen || DEFAULT_IMAGE,
    esRecomendada: Boolean(ev.es_recomendada ?? ev.esRecomendada ?? ev.recomendado ?? ev.recommended),
    motivoRecomendacion: ev.motivo_recommend || ev.motivoRecomendacion || "",
  };
}

export function mapNegocioFromApi(neg, usuarioActual) {
  const propId = neg.propietario?.id ? Number(neg.propietario.id) : null;
  const esMio = Boolean(usuarioActual && propId && Number(usuarioActual.id) === propId);

  return {
    id: Number(neg.id),
    nombre: neg.nombre,
    esMio,
    propietarioId: propId,
    pueblo: neg.pueblo || "Lucainena de las Torres",
    coordenadas: neg.coordenadas || "",
    telefonoPublicador: neg.propietario?.telefono || "+34600112233",
    actividadesAprobadas: Number(neg.fiabilidad ?? 0) >= 85 ? 10 : Number(neg.fiabilidad ?? 0) >= 50 ? 3 : 0,
    cuentaVerificada: Number(neg.fiabilidad ?? 0) >= 85,
    fiabilidad: Number(neg.fiabilidad ?? 0),
    pendiente: Number(neg.fiabilidad ?? 0) <= 0,
    propietarioNombre: neg.propietario?.nombre || "",
    instagramUrl: neg.instagramUrl || "",
    facebookUrl: neg.facebookUrl || "",
    twitterUrl: neg.twitterUrl || "",
    webUrl: neg.webUrl || "",
    resenas: [],
  };
}

