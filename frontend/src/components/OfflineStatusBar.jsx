import React from "react";
import { useApp } from "../context/useApp.js";

function formatearHoraCache(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Componente dedicado al estado de conectividad, sincronización e instalación PWA (SRP).
 */
export default function OfflineStatusBar() {
  const {
    isOnline,
    pendientesSyncCount,
    sincronizando,
    ultimaActualizacion,
    sincronizarPendientes,
    puedeInstalarPwa,
    instalarPwa,
  } = useApp();

  if (isOnline && pendientesSyncCount === 0 && !sincronizando && !puedeInstalarPwa) {
    return null;
  }

  const horaCache = formatearHoraCache(ultimaActualizacion);

  return (
    <div
      className={`border-b text-xs sm:text-sm transition-colors ${
        !isOnline
          ? "bg-amber-100 border-amber-300 text-amber-950"
          : "bg-blue-100 border-blue-300 text-blue-950"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {(!isOnline || sincronizando) && (
            <span
              className={`inline-flex items-center gap-1.5 font-black px-2.5 py-1 rounded-full ${
                !isOnline
                  ? "bg-amber-400 text-stone-950"
                  : "bg-blue-600 text-white"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  !isOnline ? "bg-stone-950" : "bg-white animate-pulse"
                }`}
                aria-hidden="true"
              />
              {!isOnline ? "Sin conexión · Modo Offline" : "Sincronizando cambios..."}
            </span>
          )}

          {!isOnline && (
            <span className="font-bold">
              Consultando eventos guardados{horaCache ? ` (${horaCache})` : ""}. Los cambios se enviarán al volver la red.
            </span>
          )}

          {pendientesSyncCount > 0 && (
            <span className="bg-amber-400 text-stone-950 font-black px-2.5 py-1 rounded-full">
              {pendientesSyncCount}{" "}
              {pendientesSyncCount === 1 ? "cambio pendiente" : "cambios pendientes"}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isOnline && pendientesSyncCount > 0 && !sincronizando && (
            <button
              type="button"
              onClick={sincronizarPendientes}
              className="bg-blue-700 hover:bg-blue-800 text-white font-black px-3 py-1.5 rounded-xl text-xs shadow-sm"
            >
              Sincronizar ahora
            </button>
          )}

          {puedeInstalarPwa && (
            <button
              type="button"
              onClick={instalarPwa}
              className="bg-amber-400 hover:bg-amber-300 text-stone-950 font-black px-3 py-1.5 rounded-xl text-xs shadow-sm"
            >
              Instalar App
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

