import React from "react";
import { useApp } from "../context/AppContext.jsx";

export default function MyPlans() {
  const { actividades, misInscripcionesIds, desapuntarse, setModalResenas } = useApp();

  return (
    <div id="tab-contenido-misplanes" className="caja-panel bg-white p-5 rounded-3xl shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-black text-lg">📅 Mis Planes Apuntados</h2>
        <span
          id="badge-total-inscritos"
          className="bg-blue-700 text-white font-black text-sm px-3 py-0.5 rounded-full"
        >
          {misInscripcionesIds.length}
        </span>
      </div>

      <ul id="lista-inscripciones" className="space-y-2.5 text-sm">
        {misInscripcionesIds.length === 0 ? (
          <li className="p-3 rounded-2xl bg-blue-50 text-stone-600 text-center">
            Todavía no te has apuntado a ningún plan.
          </li>
        ) : (
          misInscripcionesIds.map((id) => {
            const act = actividades.find((a) => a.id === id);
            if (!act) return null;
            return (
              <li
                key={id}
                className="p-3 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-between gap-2"
              >
                <div>
                  <p className="font-black">{act.nombre}</p>
                  <p className="text-xs text-stone-600">
                    {act.pueblo} · {act.fecha}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => desapuntarse(id)}
                  className="bg-red-100 hover:bg-red-200 text-red-900 font-bold px-3 py-2 rounded-xl text-xs shrink-0"
                >
                  Quitar
                </button>
              </li>
            );
          })
        )}
      </ul>

      <div className="pt-3 border-t border-blue-200 space-y-2">
        <h3 className="font-black text-base">📜 Actividades ya hechas</h3>
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2">
          <div>
            <p className="font-bold text-sm">Fiesta de Montesión</p>
            <p className="text-xs text-stone-600">Lucainena</p>
          </div>
          <button
            type="button"
            onClick={() => setModalResenas({ open: true, nombreNegocio: "Ayuntamiento de Lucainena" })}
            className="bg-amber-400 hover:bg-amber-300 text-stone-950 font-black px-3 py-2 rounded-xl text-xs"
          >
            ⭐ Opinar
          </button>
        </div>
      </div>
    </div>
  );
}
