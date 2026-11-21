import React from "react";
import { useApp } from "../context/AppContext.jsx";

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
    modoOfflineSimulado,
    toggleModoOfflineSimulado,
    pendientesSyncCount,
    sincronizando,
    ultimaActualizacion,
    sincronizarPendientes,
    puedeInstalarPwa,
    instalarPwa,
  } = useApp();

  const horaCache = formatearHoraCache(ultimaActualizacion);

  return (
    <div
      className={`border-b text-xs sm:text-sm transition-colors ${
        !isOnline
          ? "bg-amber-100 border-amber-300 text-amber-950"
          : pendientesSyncCount > 0 || sincronizando
            ? "bg-blue-100 border-blue-300 text-blue-950"
            : "bg-blue-950/95 border-blue-900 text-blue-100"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span
            className={`inline-flex items-center gap-1.5 font-black px-2.5 py-1 rounded-full ${
              !isOnline
                ? "bg-amber-400 text-stone-950"
                : sincronizando
                  ? "bg-blue-600 text-white"
                  : "bg-emerald-500/20 text-emerald-200 border border-emerald-400/30"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                !isOnline
                  ? "bg-stone-950"
                  : sincronizando
                    ? "bg-white animate-pulse"
                    : "bg-emerald-400"
              }`}
              aria-hidden="true"
            />
            {!isOnline
              ? modoOfflineSimulado
                ? "Modo Sin Cobertura (Simulado)"
                : "Sin conexión · Modo Offline"
              : sincronizando
                ? "Sincronizando cambios..."
                : "Conectado · PWA Lista Offline"}
          </span>

          {!isOnline && (
            <span className="font-bold">
              Consultando eventos guardados{horaCache ? ` (${horaCache})` : ""}. Los cambios se guardarán y enviarán al volver la red.
            </span>
          )}

          {isOnline && horaCache && pendientesSyncCount === 0 && !sincronizando && (
            <span className="hidden sm:inline text-blue-200 font-medium">
              Copia offline actualizada a las {horaCache}
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

          <button
            type="button"
            onClick={toggleModoOfflineSimulado}
            title="Activa o desactiva una simulación de pueblo sin cobertura para probar el modo offline"
            className={`font-bold px-3 py-1.5 rounded-xl text-xs border transition ${
              modoOfflineSimulado
                ? "bg-stone-900 hover:bg-stone-800 text-amber-300 border-stone-900"
                : !isOnline
                  ? "bg-white/80 hover:bg-white text-amber-950 border-amber-400"
                  : "bg-white/10 hover:bg-white/20 text-white border-white/20"
            }`}
          >
            {modoOfflineSimulado ? "Reconectar red" : "Probar sin cobertura"}
          </button>
        </div>
      </div>
    </div>
  );
}

