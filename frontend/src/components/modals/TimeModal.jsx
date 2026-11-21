import React, { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext.jsx";

export default function TimeModal() {
  const { modalCambiarHora, setModalCambiarHora, guardarNuevaHora } = useApp();
  const [inicio, setInicio] = useState("");
  const [fin, setFin] = useState("");

  const act = modalCambiarHora.actividad;

  useEffect(() => {
    if (act) {
      setInicio(act.fechaInicioISO || "2026-11-29T12:00");
      setFin(act.fechaFinISO || "2026-11-29T14:00");
    }
  }, [act]);

  if (!modalCambiarHora.open || !act) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    guardarNuevaHora(act.id, inicio, fin);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white text-stone-900 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border-2 border-blue-700">
        <div className="flex justify-between items-center border-b pb-3">
          <h3 className="font-black text-xl">🕒 Cambiar Fecha y Hora</h3>
          <button
            type="button"
            onClick={() => setModalCambiarHora({ open: false, actividad: null })}
            className="w-10 h-10 rounded-full bg-blue-100 font-black text-xl hover:bg-blue-200"
          >
            ✕
          </button>
        </div>

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
              className="w-full border-2 border-blue-300 rounded-xl p-3 bg-white font-bold"
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-1">Nueva fecha y hora de fin *</label>
            <input
              type="datetime-local"
              required
              value={fin}
              onChange={(e) => setFin(e.target.value)}
              className="w-full border-2 border-blue-300 rounded-xl p-3 bg-white font-bold"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-amber-400 hover:bg-amber-500 text-stone-950 font-black py-3.5 rounded-2xl shadow"
          >
            ✅ Guardar Nueva Hora
          </button>
        </form>
      </div>
    </div>
  );
}
