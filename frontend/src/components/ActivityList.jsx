import React, { useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import ActivityCard from "./ActivityCard.jsx";

const FILTROS_ESTADO = [
  { id: "todos", label: "Todos" },
  { id: "activos", label: "Activos" },
  { id: "por_venir", label: "Por venir" },
  { id: "finalizados", label: "Finalizados" },
];

function getTimestamp(msVal, isoVal) {
  if (typeof msVal === "number" && !Number.isNaN(msVal)) return msVal;
  if (!isoVal) return NaN;
  return new Date(isoVal).getTime();
}

function getEstadoTemporal(act, ahoraMs) {
  const inicioMs = getTimestamp(act.fechaInicioMs, act.fechaInicioISO);
  const finMs = getTimestamp(act.fechaFinMs, act.fechaFinISO);

  if (!Number.isNaN(finMs) && finMs <= ahoraMs) return "finalizados";
  if (!Number.isNaN(inicioMs) && inicioMs <= ahoraMs) return "activos";
  return "por_venir";
}

export default function ActivityList() {
  const { actividades, puebloActivo, usuario } = useApp();
  const [filtroEstado, setFiltroEstado] = useState("todos");

  const esPublicador = usuario && usuario.tipoUsuario === "PUBLICADOR";
  const ahoraMs = Date.now();

  const listaBase = actividades.filter((a) => {
    if (a.estadoModeracion === "denegada") return false;
    if (a.estadoModeracion === "pendiente" && !esPublicador) return false;
    return puebloActivo === "Todos" || a.pueblo === puebloActivo;
  });

  const conteos = {
    todos: listaBase.length,
    activos: 0,
    por_venir: 0,
    finalizados: 0,
  };
  for (const act of listaBase) {
    const est = getEstadoTemporal(act, ahoraMs);
    conteos[est] += 1;
  }

  const lista =
    filtroEstado === "todos"
      ? listaBase
      : listaBase.filter((act) => getEstadoTemporal(act, ahoraMs) === filtroEstado);

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Filtrar actividades por estado"
        className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm"
      >
        {FILTROS_ESTADO.map((f) => {
          const activo = filtroEstado === f.id;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={activo}
              onClick={() => setFiltroEstado(f.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-black transition ${
                activo
                  ? "bg-blue-700 text-white shadow-sm"
                  : "bg-slate-100 hover:bg-blue-50 text-blue-950"
              }`}
            >
              <span>{f.label}</span>
              <span
                className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                  activo ? "bg-white/20 text-white" : "bg-white text-blue-900"
                }`}
              >
                {conteos[f.id]}
              </span>
            </button>
          );
        })}
      </div>

      {lista.length === 0 ? (
        <div className="bg-white p-8 rounded-3xl text-center border border-slate-200 shadow-sm space-y-2">
          <p className="text-lg font-bold">
            {listaBase.length === 0
              ? "No hay actividades en este pueblo ahora mismo."
              : `No hay actividades en "${FILTROS_ESTADO.find((f) => f.id === filtroEstado)?.label}".`}
          </p>
          <p className="text-sm text-stone-600">
            {listaBase.length === 0
              ? 'Pulsa "Todos" arriba para ver los planes de toda la comarca.'
              : "Prueba otro filtro para ver el resto de planes."}
          </p>
          {listaBase.length > 0 && filtroEstado !== "todos" && (
            <button
              type="button"
              onClick={() => setFiltroEstado("todos")}
              className="mt-2 bg-blue-700 hover:bg-blue-800 text-white font-black px-4 py-2 rounded-xl text-sm"
            >
              Ver todos ({listaBase.length})
            </button>
          )}
        </div>
      ) : (
        <div id="grid-actividades" className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {lista.map((act) => (
            <ActivityCard key={act.id} act={act} />
          ))}
        </div>
      )}
    </div>
  );
}
