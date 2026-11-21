import React, { useEffect, useState, useCallback } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { eventosApi } from "../../api/client.js";
import { IconClose } from "../Icons.jsx";

export default function AttendeesModal() {
  const { modalInscritos, setModalInscritos } = useApp();
  const [inscritos, setInscritos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const act = modalInscritos.actividad;

  const cerrarModal = useCallback(() => {
    setModalInscritos({ open: false, actividad: null });
  }, [setModalInscritos]);

  useEffect(() => {
    if (!modalInscritos.open || !act?.id) return;
    let active = true;
    setCargando(true);
    eventosApi
      .verInscritos(act.id)
      .then((res) => {
        if (active) {
          const lista = (res?.data?.inscritos || []).map((item) => ({
            nombre: item.usuario?.nombre || "Vecino",
            email: item.usuario?.email || "",
            telefono: item.usuario?.telefono || "",
          }));
          setInscritos(lista);
        }
      })
      .catch(() => {
        if (active) setInscritos(act.listaInscritos || []);
      })
      .finally(() => {
        if (active) setCargando(false);
      });
    return () => {
      active = false;
    };
  }, [modalInscritos.open, act]);

  useEffect(() => {
    if (!modalInscritos.open) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") cerrarModal();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalInscritos.open, cerrarModal]);

  if (!modalInscritos.open || !act) return null;

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
        <div className="shrink-0 flex justify-between items-center px-5 py-3.5 border-b border-blue-100 bg-white gap-2">
          <div className="min-w-0">
            <h3 className="font-black text-lg truncate">Personas Apuntadas</h3>
            <p className="text-xs text-stone-600 truncate">
              {act.nombre} ({act.asistentes} de {act.aforo})
            </p>
          </div>
          <button
            type="button"
            onClick={cerrarModal}
            aria-label="Cerrar ventana"
            className="btn-cerrar-modal w-11 h-11 rounded-full bg-blue-100 text-blue-950 hover:bg-blue-200 flex items-center justify-center shrink-0"
          >
            <IconClose className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-2 text-sm">
          {cargando ? (
            <p className="text-stone-500 text-center py-4">Cargando inscritos...</p>
          ) : inscritos.length === 0 ? (
            <p className="text-stone-500 text-center py-4">Aún no hay nadie apuntado.</p>
          ) : (
            inscritos.map((p, i) => (
              <div key={i} className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                <b className="text-blue-950">
                  {i + 1}. {p.nombre}
                </b>
                <div className="text-xs text-stone-600 mt-0.5 break-all">
                  {p.email} · {p.telefono}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
