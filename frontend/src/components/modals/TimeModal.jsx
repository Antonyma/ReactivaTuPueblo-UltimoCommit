import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { IconCheck, IconClock, IconClose } from "../Icons.jsx";

export default function TimeModal() {
  const { modalCambiarHora, setModalCambiarHora, guardarNuevaHora } = useApp();
  const [inicio, setInicio] = useState("");
  const [fin, setFin] = useState("");

  const act = modalCambiarHora.actividad;

  const cerrarModal = useCallback(() => {
    setModalCambiarHora({ open: false, actividad: null });
  }, [setModalCambiarHora]);

  useEffect(() => {
    if (act) {
      setInicio(act.fechaInicioISO || "2026-11-29T12:00");
      setFin(act.fechaFinISO || "2026-11-29T14:00");
    }
  }, [act]);

  useEffect(() => {
    if (!modalCambiarHora.open) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") cerrarModal();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalCambiarHora.open, cerrarModal]);

  if (!modalCambiarHora.open || !act) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    guardarNuevaHora(act.id, inicio, fin);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3 sm:p-4"
      onClick={cerrarModal}
    >
      <div
        className="bg-white text-stone-900 rounded-3xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border-2 border-blue-700"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="shrink-0 flex justify-between items-center px-5 py-3.5 border-b border-blue-100 bg-white">
          <h3 className="font-black text-lg sm:text-xl inline-flex items-center gap-2">
            <IconClock className="w-5 h-5 text-blue-700" />
            <span>Cambiar Fecha y Hora</span>
          </h3>
          <button
            type="button"
            onClick={cerrarModal}
            aria-label="Cerrar ventana"
            className="btn-cerrar-modal w-11 h-11 rounded-full bg-blue-100 text-blue-950 hover:bg-blue-200 flex items-center justify-center shrink-0"
          >
            <IconClose className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-3">
          <p className="text-sm font-black text-blue-900 bg-blue-50 p-3 rounded-2xl border border-blue-200">
            {act.nombre} ({act.pueblo})
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-bold mb-1">Nueva fecha y hora de inicio *</label>
              <input
                type="datetime-local"
                required
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
                className="w-full border-2 border-blue-300 rounded-xl p-2.5 bg-white font-bold text-base"
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-1">Nueva fecha y hora de fin *</label>
              <input
                type="datetime-local"
                required
                value={fin}
                onChange={(e) => setFin(e.target.value)}
                className="w-full border-2 border-blue-300 rounded-xl p-2.5 bg-white font-bold text-base"
              />
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-500 text-stone-950 font-black py-3 rounded-2xl shadow"
            >
              <IconCheck className="w-5 h-5" />
              <span>Guardar Nueva Hora</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
