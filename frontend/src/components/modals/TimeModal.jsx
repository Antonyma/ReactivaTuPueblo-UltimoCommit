import React, { useState, useCallback } from "react";
import { useApp } from "../../context/useApp.js";
import { getDefaultEventDateRange } from "../../utils/eventUtils.js";
import { IconCheck, IconClock } from "../Icons.jsx";
import BaseModal from "./BaseModal.jsx";

function TimeModalForm({ act, onSave }) {
  const defaults = getDefaultEventDateRange();
  const [inicio, setInicio] = useState(act.fechaInicioISO || defaults.fechaInicio);
  const [fin, setFin] = useState(act.fechaFinISO || defaults.fechaFin);
  const [errorFecha, setErrorFecha] = useState("");
  const [guardando, setGuardando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (new Date(fin) <= new Date(inicio)) {
      setErrorFecha("La fecha y hora de fin debe ser posterior a la de inicio.");
      return;
    }
    setErrorFecha("");
    setGuardando(true);
    try {
      await onSave(act.id, inicio, fin);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="time-modal-inicio" className="block text-sm font-bold mb-1">
          Nueva fecha y hora de inicio *
        </label>
        <input
          id="time-modal-inicio"
          type="datetime-local"
          required
          value={inicio}
          onChange={(e) => setInicio(e.target.value)}
          className="w-full border-2 border-blue-300 rounded-xl p-2.5 bg-white font-bold text-base"
        />
      </div>

      <div>
        <label htmlFor="time-modal-fin" className="block text-sm font-bold mb-1">
          Nueva fecha y hora de fin *
        </label>
        <input
          id="time-modal-fin"
          type="datetime-local"
          required
          value={fin}
          onChange={(e) => setFin(e.target.value)}
          className="w-full border-2 border-blue-300 rounded-xl p-2.5 bg-white font-bold text-base"
        />
      </div>

      {errorFecha && (
        <p role="alert" className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl p-2.5">
          {errorFecha}
        </p>
      )}

      <button
        type="submit"
        disabled={guardando}
        className="w-full inline-flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-500 disabled:opacity-60 text-stone-950 font-black py-3 rounded-2xl shadow"
      >
        <IconCheck className="w-5 h-5" />
        <span>{guardando ? "Guardando..." : "Guardar Nueva Hora"}</span>
      </button>
    </form>
  );
}

export default function TimeModal() {
  const { modalCambiarHora, setModalCambiarHora, guardarNuevaHora } = useApp();
  const act = modalCambiarHora.actividad;

  const cerrarModal = useCallback(() => {
    setModalCambiarHora({ open: false, actividad: null });
  }, [setModalCambiarHora]);

  return (
    <BaseModal
      open={Boolean(modalCambiarHora.open && act)}
      onClose={cerrarModal}
      title="Cambiar Fecha y Hora"
      icon={<IconClock className="w-5 h-5 text-blue-700 shrink-0" />}
      maxWidthClass="max-w-md"
      containerClassName="bg-white text-stone-900 rounded-3xl w-full max-h-[90vh] overflow-y-auto p-5 shadow-2xl border-2 border-blue-700 space-y-4"
    >
      {act && (
        <>
          <p className="text-sm font-black text-blue-900 bg-blue-50 p-3 rounded-2xl border border-blue-200">
            {act.nombre} ({act.pueblo})
          </p>
          <TimeModalForm key={act.id} act={act} onSave={guardarNuevaHora} />
        </>
      )}
    </BaseModal>
  );
}
