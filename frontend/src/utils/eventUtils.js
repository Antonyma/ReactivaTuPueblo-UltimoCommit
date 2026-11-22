export const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80";

export function getEventTimestamp(msVal, isoVal) {
  if (typeof msVal === "number" && !Number.isNaN(msVal)) return msVal;
  if (!isoVal) return NaN;
  return new Date(isoVal).getTime();
}

export function esEventoFinalizado(act, ahoraMs) {
  if (!act) return false;
  const finMs = getEventTimestamp(act.fechaFinMs, act.fechaFinISO);
  return !Number.isNaN(finMs) && finMs <= ahoraMs;
}

export function getEstadoTemporal(act, ahoraMs) {
  const inicioMs = getEventTimestamp(act.fechaInicioMs, act.fechaInicioISO);
  const finMs = getEventTimestamp(act.fechaFinMs, act.fechaFinISO);

  if (!Number.isNaN(finMs) && finMs <= ahoraMs) return "finalizados";
  if (!Number.isNaN(inicioMs) && inicioMs <= ahoraMs) return "activos";
  return "por_venir";
}

export function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function esUrlImagenSegura(url) {
  if (!url) return false;
  const s = String(url).trim();
  return (
    s.startsWith("https://") ||
    s.startsWith("http://") ||
    s.startsWith("data:image/") ||
    s.startsWith("/")
  );
}

export function getDefaultEventDateRange() {
  const pad = (n) => String(n).padStart(2, "0");
  const formatLocal = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const inicio = new Date();
  inicio.setDate(inicio.getDate() + 1);
  inicio.setHours(11, 0, 0, 0);

  const fin = new Date(inicio.getTime() + 2 * 60 * 60 * 1000);
  return {
    fechaInicio: formatLocal(inicio),
    fechaFin: formatLocal(fin),
  };
}

