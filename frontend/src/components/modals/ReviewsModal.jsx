import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { IconClose, IconStar } from "../Icons.jsx";

export default function ReviewsModal() {
  const {
    modalResenas,
    setModalResenas,
    cuentasNegocio,
    actividades,
    misInscripcionesIds,
    usuario,
    agregarResena,
    cargarResenasNegocio,
  } = useApp();
  const [estrellas, setEstrellas] = useState(5);
  const [texto, setTexto] = useState("");

  const nombreNegocio = modalResenas.nombreNegocio;

  const cerrarModal = useCallback(() => {
    setModalResenas({ open: false, nombreNegocio: null });
  }, [setModalResenas]);

  useEffect(() => {
    if (modalResenas.open && nombreNegocio) {
      cargarResenasNegocio(nombreNegocio);
    }
  }, [modalResenas.open, nombreNegocio]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!modalResenas.open) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") cerrarModal();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalResenas.open, cerrarModal]);

  if (!modalResenas.open || !nombreNegocio) return null;

  const info = cuentasNegocio[nombreNegocio] || { resenas: [] };
  const resenas = info.resenas || [];

  const eventosAsistidos = actividades.filter(
    (a) => a.negocio === nombreNegocio && misInscripcionesIds.includes(a.id)
  );
  const ahoraMs = Date.now();
  const puedeResenar =
    Boolean(usuario) &&
    eventosAsistidos.some((a) => {
      if (!a.fechaFinISO) return false;
      const finMs = new Date(a.fechaFinISO).getTime();
      return !Number.isNaN(finMs) && finMs <= ahoraMs;
    });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!texto.trim()) return;
    agregarResena(nombreNegocio, estrellas, texto.trim());
    setTexto("");
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
        <div className="shrink-0 flex justify-between items-center px-5 py-3.5 border-b border-blue-100 bg-white gap-2">
          <div className="min-w-0">
            <h3 className="font-black text-lg truncate">Opiniones: {nombreNegocio}</h3>
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

        <div className="overflow-y-auto px-5 py-4 space-y-3">
          <div className="max-h-44 overflow-y-auto space-y-2 text-sm bg-blue-50 p-3 rounded-2xl border border-blue-200">
            {resenas.length === 0 ? (
              <p className="text-stone-500 text-center py-2">Sin opiniones todavía.</p>
            ) : (
              resenas.map((r, i) => (
                <div key={i} className="p-2.5 bg-white rounded-xl border border-blue-200">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold">
                      {r.usuario}
                      {r.pendienteSync && (
                        <span className="ml-1.5 text-[10px] font-black bg-amber-200 text-amber-950 px-2 py-0.5 rounded-full">
                          ⏳ Pendiente de red
                        </span>
                      )}
                    </span>
                    <span
                      className="inline-flex items-center gap-0.5 text-amber-500"
                      aria-label={`${r.estrellas} de 5 estrellas`}
                    >
                      {Array.from({ length: r.estrellas }).map((_, idx) => (
                        <IconStar key={idx} className="w-4 h-4" filled />
                      ))}
                    </span>
                  </div>
                  <p className="text-xs text-stone-700 mt-1">{r.texto}</p>
                </div>
              ))
            )}
          </div>

          {puedeResenar ? (
            <form onSubmit={handleSubmit} className="space-y-2.5">
              <select
                value={estrellas}
                onChange={(e) => setEstrellas(Number(e.target.value))}
                className="w-full border-2 border-blue-300 rounded-xl p-2.5 font-bold bg-white text-base"
              >
                <option value="5">5 estrellas - Excelente</option>
                <option value="4">4 estrellas - Muy bien</option>
                <option value="3">3 estrellas - Normal</option>
                <option value="2">2 estrellas - Regular</option>
                <option value="1">1 estrella - Mal</option>
              </select>

              <input
                type="text"
                required
                placeholder="Escribe tu opinión aquí..."
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                className="w-full border-2 border-blue-300 rounded-xl p-2.5 text-base"
              />

              <button
                type="submit"
                className="w-full bg-blue-700 hover:bg-blue-800 text-white font-black py-3 rounded-2xl shadow"
              >
                Enviar Opinión
              </button>
            </form>
          ) : (
            <p className="text-xs sm:text-sm text-blue-950 bg-blue-50 border border-blue-200 p-3 rounded-2xl text-center font-bold">
              {eventosAsistidos.length > 0
                ? "Podrás dejar tu reseña cuando haya acabado el evento al que te apuntaste."
                : "Solo puedes reseñar si te has apuntado a un evento de este negocio y ya ha acabado."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
