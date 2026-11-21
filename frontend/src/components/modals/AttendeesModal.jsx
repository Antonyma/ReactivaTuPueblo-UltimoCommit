import React from "react";
import { useApp } from "../../context/AppContext.jsx";

export default function AttendeesModal() {
  const { modalInscritos, setModalInscritos } = useApp();
  const act = modalInscritos.actividad;

  if (!modalInscritos.open || !act) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white text-stone-900 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border-2 border-blue-700">
        <div className="flex justify-between items-center border-b pb-3">
          <div>
            <h3 className="font-black text-lg">Personas Apuntadas</h3>
            <p className="text-xs text-stone-600">{act.nombre} ({act.asistentes} de {act.aforo})</p>
          </div>
          <button
            type="button"
            onClick={() => setModalInscritos({ open: false, actividad: null })}
            className="w-10 h-10 rounded-full bg-blue-100 font-black text-xl hover:bg-blue-200"
          >
            ✕
          </button>
        </div>

        <div className="max-h-60 overflow-y-auto space-y-2 text-sm">
          {(!act.listaInscritos || act.listaInscritos.length === 0) ? (
            <p className="text-stone-500 text-center py-4">Aún no hay nadie apuntado.</p>
          ) : (
            act.listaInscritos.map((p, i) => (
              <div key={i} className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                <b className="text-blue-950">{i + 1}. {p.nombre}</b>
                <div className="text-xs text-stone-600 mt-0.5">{p.email} · {p.telefono}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
