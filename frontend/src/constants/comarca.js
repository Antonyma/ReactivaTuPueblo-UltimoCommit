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

export const TIPO_EVENTO_A_CATEGORIA = {
  1: "Turismo",
  2: "Fiesta Patronal",
  3: "Gastronomía",
  4: "Comercio",
  5: "Deportes",
  6: "Cultura"
};

export const CATEGORIA_A_TIPO_EVENTO = {
  ...Object.fromEntries(
    Object.entries(TIPO_EVENTO_A_CATEGORIA).map(([k, v]) => [v, Number(k)])
  ),
  Deporte: 5,
};

export function evaluarFiabilidadNegocio(nombreNegocio, cuentas = {}) {
  const info = cuentas[nombreNegocio];
  if (!info) {
    return { nivel: 1, esDeConfianza: false, media: "0.0", motivo: "Cuenta nueva (Nivel 1)" };
  }

  const resenas = info.resenas || [];
  const totalRes = resenas.length;
  const mediaNum = totalRes > 0 ? resenas.reduce((acc, r) => acc + r.estrellas, 0) / totalRes : 0;

  let nivel = 1;
  const fiab = Number(info.fiabilidad ?? 0);
  if (fiab >= 85 || (info.cuentaVerificada && (info.actividadesAprobadas ?? 0) >= 8)) {
    nivel = 3;
  } else if (fiab >= 50 || (info.actividadesAprobadas ?? 0) >= 2 || (totalRes >= 1 && mediaNum >= 4.0)) {
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

export function formatearTelefonoConPrefijo(rawTel) {
  if (!rawTel) return "";
  const limpio = String(rawTel).trim().replace(/\s+/g, "");
  if (!limpio) return "";
  if (limpio.startsWith("+34")) return limpio;
  return "+34" + limpio.replace(/^\+/, "");
}

export function formatearFechaBonita(isoStr) {
  if (!isoStr) return "Próximamente";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return String(isoStr);
  const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  return `${dias[d.getDay()]} · ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}h`;
}

