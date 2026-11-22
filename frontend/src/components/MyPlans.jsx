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
    <div id="tab-contenido-misplanes" className="caja-panel bg-white p-4 sm:p-5 rounded-3xl shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-black text-lg inline-flex items-center gap-2">
          <IconCalendar className="w-5 h-5 text-[#3D5A3C] shrink-0" />
          <span>Mis Planes Apuntados</span>
        </h2>
        <span
          id="badge-total-inscritos"
          className="bg-[#3D5A3C] text-white font-black text-sm px-3 py-0.5 rounded-full shrink-0"
        >
          {planesActivos.length}
        </span>
      </div>

      <ul id="lista-inscripciones" className="space-y-2.5 text-sm">
        {planesActivos.length === 0 ? (
          <li className="p-3 rounded-2xl bg-[#F5EFE4] text-stone-600 text-center">
            Todavía no te has apuntado a ningún plan próximo.
          </li>
        ) : (
          planesActivos.map((act) => {
            const pendienteSync = inscripcionesPendientesIds.includes(act.id);
            return (
              <li
                key={act.id}
                className="p-3 rounded-2xl bg-[#FAF6EE] border border-[#E5DCCB] flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="font-black truncate">{act.nombre}</p>
                  <p className="text-xs text-stone-600">
                    {act.pueblo} · {act.fecha}
                  </p>
                  {pendienteSync && (
                    <span className="inline-block mt-1 text-[11px] font-black bg-amber-200 text-amber-950 px-2 py-0.5 rounded-full">
                      ⏳ Guardado sin red · Se confirmará al conectar
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => desapuntarse(act.id)}
                  className="bg-red-100 hover:bg-red-200 text-red-900 font-bold px-3 py-2 rounded-xl text-xs shrink-0"
                >
                  Quitar
                </button>
              </li>
            );
          })
        )}
      </ul>

      <div className="pt-3 border-t border-[#E5DCCB] space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-black text-base">Actividades ya hechas</h3>
          <span className="bg-emerald-700 text-white font-black text-xs px-2.5 py-0.5 rounded-full">
            {actividadesHechas.length}
          </span>
        </div>

        {actividadesHechas.length === 0 ? (
          <p className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs text-stone-600 text-center">
            Cuando termine una actividad a la que te hayas apuntado, aparecerá aquí para que puedas opinar.
          </p>
        ) : (
          <div className="space-y-2">
            {actividadesHechas.map((act) => {
              const yaValorado = misValoracionesEventoIds.includes(act.id);
              return (
                <div
                  key={act.id}
                  className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{act.nombre}</p>
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
                      className="inline-flex items-center gap-1 bg-emerald-200 hover:bg-emerald-300 text-emerald-950 font-black px-3 py-2 rounded-xl text-xs shrink-0"
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
                      className="inline-flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-stone-950 font-black px-3 py-2 rounded-xl text-xs shrink-0"
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
