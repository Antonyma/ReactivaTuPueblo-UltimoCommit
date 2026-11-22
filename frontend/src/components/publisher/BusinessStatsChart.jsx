import React, { useMemo } from "react";
import { calcularMetricasEventos } from "./publisherMetrics.js";

const COLORES_CATEGORIA = {
  "Fiesta Patronal": "#f59e0b",
  Deportes: "#10b981",
  Deporte: "#10b981",
  Gastronomía: "#f97316",
  Turismo: "#3b82f6",
  Comercio: "#8b5cf6",
  Cultura: "#ec4899",
};

function polar(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function slicePath(cx, cy, r, start, end) {
  if (end - start >= 359.99) {
    return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 -${2 * r} 0`;
  }
  const s = polar(cx, cy, r, start);
  const e = polar(cx, cy, r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y} Z`;
}

const BusinessStatsChart = React.memo(function BusinessStatsChart({ eventos, ahoraMs }) {
  const metricas = useMemo(
    () => calcularMetricasEventos(eventos, ahoraMs),
    [eventos, ahoraMs]
  );

  const { entries, total, slices } = useMemo(() => {
    const stats = (eventos || []).reduce((acc, act) => {
      const cat = act.categoria || "Otros";
      acc[cat] = (acc[cat] || 0) + (act.asistentes || 0);
      return acc;
    }, {});

    const list = Object.entries(stats).filter(([, v]) => v > 0);
    const sum = list.reduce((s, [, v]) => s + v, 0);

    let acum = 0;
    const computedSlices = list.map(([cat, val]) => {
      const start = sum > 0 ? (acum / sum) * 360 : 0;
      acum += val;
      const end = sum > 0 ? (acum / sum) * 360 : 0;
      return { cat, val, start, end };
    });

    return { entries: list, total: sum, slices: computedSlices };
  }, [eventos]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-3">
          <p className="text-[11px] font-black uppercase text-blue-900">Eventos</p>
          <p className="text-2xl font-black text-blue-950 mt-0.5">{metricas.totalEventos}</p>
          <p className="text-xs text-stone-600">
            {metricas.activos} activos · {metricas.finalizados} finalizados
          </p>
        </div>

        <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-3">
          <p className="text-[11px] font-black uppercase text-emerald-900">Inscritos</p>
          <p className="text-2xl font-black text-emerald-950 mt-0.5">{metricas.totalInscritos}</p>
          <p className="text-xs text-stone-600">
            {metricas.totalAforo > 0
              ? `${metricas.ocupacionMedia}% de ${metricas.totalAforo} plazas`
              : "Sin aforo definido"}
          </p>
        </div>

        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3">
          <p className="text-[11px] font-black uppercase text-amber-900">Valoración</p>
          <p className="text-2xl font-black text-stone-950 mt-0.5">
            {metricas.valoracionMedia !== null ? `${metricas.valoracionMedia} / 5` : "—"}
          </p>
          <p className="text-xs text-stone-600">
            {metricas.totalValoraciones > 0
              ? `${metricas.totalValoraciones} reseña${metricas.totalValoraciones === 1 ? "" : "s"}`
              : "Sin reseñas aún"}
          </p>
        </div>

        <div className="bg-indigo-50/80 border border-indigo-200 rounded-2xl p-3">
          <p className="text-[11px] font-black uppercase text-indigo-900">Más popular</p>
          {metricas.eventoDestacado ? (
            <>
              <p className="text-sm font-black text-indigo-950 mt-1 truncate">
                {metricas.eventoDestacado.nombre}
              </p>
              <p className="text-xs text-stone-600 mt-0.5">
                {metricas.eventoDestacado.asistentes} apuntados
              </p>
            </>
          ) : (
            <p className="text-xs text-stone-600 mt-1.5">Aún sin inscripciones</p>
          )}
        </div>
      </div>

      <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-3 space-y-2">
        <p className="text-sm font-black text-blue-950">Inscripciones por categoría</p>
        {total === 0 ? (
          <p className="text-xs text-stone-600">
            Aún no hay inscripciones en las actividades de este negocio.
          </p>
        ) : (
          <div className="flex items-center gap-3">
            <svg
              viewBox="0 0 120 120"
              className="w-24 h-24 shrink-0"
              role="img"
              aria-label="Distribución de inscripciones por categoría"
            >
              {slices.map((sl) => (
                <path
                  key={sl.cat}
                  d={slicePath(60, 60, 50, sl.start, sl.end)}
                  fill={COLORES_CATEGORIA[sl.cat] || "#94a3b8"}
                />
              ))}
            </svg>
            <ul className="text-xs space-y-1 min-w-0">
              {entries.map(([cat, val]) => (
                <li key={cat} className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-sm shrink-0"
                    style={{ background: COLORES_CATEGORIA[cat] || "#94a3b8" }}
                  />
                  <span className="truncate">{cat}</span>
                  <span className="font-bold shrink-0">
                    {val} ({Math.round((val / total) * 100)}%)
                  </span>
                </li>
              ))}
              <li className="font-black text-stone-700 pt-1">Total: {total}</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
});

export default BusinessStatsChart;
