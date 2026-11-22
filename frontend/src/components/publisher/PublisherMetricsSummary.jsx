import React, { useMemo } from "react";
import { calcularMetricasEventos } from "./publisherMetrics.js";

const PublisherMetricsSummary = React.memo(function PublisherMetricsSummary({
  negocios = [],
  negociosConfirmadosCount = 0,
  eventos = [],
  ahoraMs,
}) {
  const metricas = useMemo(
    () => calcularMetricasEventos(eventos, ahoraMs),
    [eventos, ahoraMs]
  );

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-3.5">
        <p className="text-[11px] font-black uppercase tracking-wide text-blue-900">
          Mis negocios
        </p>
        <p className="text-2xl font-black text-blue-950 mt-1">{negocios.length}</p>
        <p className="text-xs text-stone-600 mt-0.5">
          {negociosConfirmadosCount} confirmados
          {negocios.length - negociosConfirmadosCount > 0
            ? ` · ${negocios.length - negociosConfirmadosCount} pendientes`
            : ""}
        </p>
      </div>

      <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-3.5">
        <p className="text-[11px] font-black uppercase tracking-wide text-emerald-900">
          Eventos publicados
        </p>
        <p className="text-2xl font-black text-emerald-950 mt-1">{metricas.totalEventos}</p>
        <p className="text-xs text-stone-600 mt-0.5">
          {metricas.activos} activos · {metricas.finalizados} finalizados
        </p>
      </div>

      <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3.5">
        <p className="text-[11px] font-black uppercase tracking-wide text-amber-900">
          Total inscritos
        </p>
        <p className="text-2xl font-black text-stone-950 mt-1">{metricas.totalInscritos}</p>
        <p className="text-xs text-stone-600 mt-0.5">
          {metricas.totalAforo > 0
            ? `Ocupación media: ${metricas.ocupacionMedia}%`
            : "Sin plazas registradas aún"}
        </p>
      </div>

      <div className="bg-indigo-50/80 border border-indigo-200 rounded-2xl p-3.5">
        <p className="text-[11px] font-black uppercase tracking-wide text-indigo-900">
          Valoración media
        </p>
        <p className="text-2xl font-black text-indigo-950 mt-1">
          {metricas.valoracionMedia !== null ? `${metricas.valoracionMedia} / 5` : "—"}
        </p>
        <p className="text-xs text-stone-600 mt-0.5">
          {metricas.totalValoraciones > 0
            ? `${metricas.totalValoraciones} reseña${metricas.totalValoraciones === 1 ? "" : "s"}`
            : "Sin reseñas todavía"}
        </p>
      </div>
    </div>
  );
});

export default PublisherMetricsSummary;

