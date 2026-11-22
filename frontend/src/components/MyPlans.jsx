import React, { useMemo } from "react";
import { useApp } from "../context/useApp.js";
import { useNow } from "../hooks/useNow.js";
import { esEventoFinalizado } from "../utils/eventUtils.js";
import { IconCalendar, IconCheck, IconStar } from "./Icons.jsx";

export default function MyPlans() {
  const {
    actividades,
    misInscripcionesIds,
    misValoracionesEventoIds,
    inscripcionesPendientesIds,
    desapuntarse,
    setModalResenas,
  } = useApp();

  const ahoraMs = useNow(60000);

  const { planesActivos, actividadesHechas } = useMemo(() => {
    const porId = new Map(actividades.map((a) => [Number(a.id), a]));
    const activos = [];
    const hechas = [];
    for (const id of misInscripcionesIds) {
      const act = porId.get(Number(id));
      if (!act) continue;
      if (esEventoFinalizado(act, ahoraMs)) {
        hechas.push(act);
      } else {
        activos.push(act);
      }
    }
    return { planesActivos: activos, actividadesHechas: hechas };
  }, [actividades, misInscripcionesIds, ahoraMs]);

  return (
    <div id="tab-contenido-misplanes" className="caja-panel bg-white p-4 sm:p-5 rounded-2xl border-t-4 border-t-[#3D5A3C] space-y-4 scroll-mt-24">
      <div className="flex items-center justify-between gap-2 border-b border-[#E5E2DC] pb-2.5">
        <h2 className="font-bold text-lg inline-flex items-center gap-2">
          <IconCalendar className="w-5 h-5 text-[#3D5A3C] shrink-0" />
          <span>Mis Planes Apuntados</span>
        </h2>
        <span
          id="badge-total-inscritos"
          className="bg-[#3D5A3C] text-white font-bold text-xs px-2.5 py-0.5 rounded-lg shrink-0"
        >
          {planesActivos.length}
        </span>
      </div>

      <ul id="lista-inscripciones" className="space-y-2 text-sm">
        {planesActivos.length === 0 ? (
          <li className="py-4 px-3 rounded-xl bg-[#FAF9F6] border border-dashed border-[#D6D3CD] text-stone-500 text-center text-xs">
            Todavía no te has apuntado a ningún plan próximo.
          </li>
        ) : (
          planesActivos.map((act) => {
            const pendienteSync = inscripcionesPendientesIds.includes(act.id);
            return (
              <li
                key={act.id}
                className="p-3 rounded-xl bg-[#FAF9F6] border border-[#E5E2DC] flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="font-bold truncate text-[#16324F]">{act.nombre}</p>
                  <p className="text-xs text-stone-600">
                    {act.pueblo} · {act.fecha}
                  </p>
                  {pendienteSync && (
                    <span className="inline-block mt-1 text-[11px] font-bold bg-amber-200 text-amber-950 px-2 py-0.5 rounded-md">
                      Guardado sin red · Pendiente
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => desapuntarse(act.id)}
                  className="bg-white hover:bg-rose-50 text-[#7F1D1D] border border-rose-300 font-bold px-2.5 py-1.5 rounded-lg text-xs shrink-0 transition"
                >
                  Quitar
                </button>
              </li>
            );
          })
        )}
      </ul>

      <div className="pt-3 border-t border-[#D6D3CD] space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold text-base">Actividades ya hechas</h3>
          <span className="bg-[#16324F] text-white font-bold text-xs px-2 py-0.5 rounded-sm">
            {actividadesHechas.length}
          </span>
        </div>

        {actividadesHechas.length === 0 ? (
          <p className="py-2 text-xs text-stone-500 text-center">
            Cuando termine una actividad a la que te hayas apuntado, aparecerá aquí para que puedas opinar.
          </p>
        ) : (
          <div className="divide-y divide-[#EFECE6]">
            {actividadesHechas.map((act) => {
              const yaValorado = misValoracionesEventoIds.includes(act.id);
              return (
                <div
                  key={act.id}
                  className="py-2.5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate text-[#16324F]">{act.nombre}</p>
                    <p className="text-xs text-stone-600 truncate">
                      {act.pueblo} · {act.negocio}
                    </p>
                  </div>
                  {yaValorado ? (
                    <button
                      type="button"
                      onClick={() =>
                        setModalResenas({
                          open: true,
                          nombreNegocio: act.negocio,
                          eventoId: act.id,
                        })
                      }
                      className="inline-flex items-center gap-1 bg-[#EEF3EC] hover:bg-[#DCE7D8] text-[#2F5233] border border-[#B7C9B0] font-bold px-2.5 py-1.5 rounded text-xs shrink-0"
                    >
                      <IconCheck className="w-3.5 h-3.5" />
                      <span>Valorado</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setModalResenas({
                          open: true,
                          nombreNegocio: act.negocio,
                          eventoId: act.id,
                        })
                      }
                      className="inline-flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold px-2.5 py-1.5 rounded text-xs shrink-0"
                    >
                      <IconStar className="w-4 h-4" filled />
                      <span>Opinar</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
