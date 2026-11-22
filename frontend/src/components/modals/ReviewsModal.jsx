import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useApp } from "../../context/useApp.js";
import { useNow } from "../../hooks/useNow.js";
import { esEventoFinalizado } from "../../utils/eventUtils.js";
import { IconStar } from "../Icons.jsx";
import BaseModal from "./BaseModal.jsx";

export default function ReviewsModal() {
  const {
    modalResenas,
    setModalResenas,
    cuentasNegocio,
    resenasPorEvento,
    actividades,
    misInscripcionesIds,
    misValoracionesEventoIds,
    usuario,
    agregarResena,
    cargarResenasEvento,
    cargarResenasNegocio,
  } = useApp();
  const [estrellas, setEstrellas] = useState(5);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  const ahoraMs = useNow(60000);
  const nombreNegocio = modalResenas.nombreNegocio;
  const eventoIdObjetivo = modalResenas.eventoId ?? null;

  const cerrarModal = useCallback(() => {
    setModalResenas({ open: false, nombreNegocio: null, eventoId: null });
  }, [setModalResenas]);

  useEffect(() => {
    if (!modalResenas.open) return;
    if (eventoIdObjetivo != null) {
      cargarResenasEvento(eventoIdObjetivo);
    } else if (nombreNegocio) {
      cargarResenasNegocio(nombreNegocio);
    }
  }, [modalResenas.open, eventoIdObjetivo, nombreNegocio, cargarResenasEvento, cargarResenasNegocio]);

  const eventoActual = useMemo(
    () =>
      eventoIdObjetivo != null
        ? actividades.find((a) => Number(a.id) === Number(eventoIdObjetivo)) || null
        : null,
    [actividades, eventoIdObjetivo]
  );

  const resenas = useMemo(
    () =>
      eventoIdObjetivo != null
        ? resenasPorEvento[eventoIdObjetivo] || []
        : cuentasNegocio[nombreNegocio]?.resenas || [],
    [eventoIdObjetivo, resenasPorEvento, cuentasNegocio, nombreNegocio]
  );

  const totalResenas = resenas.length;
  const mediaResenas =
    totalResenas > 0
      ? Number(
          (resenas.reduce((acc, r) => acc + Number(r.estrellas || 0), 0) / totalResenas).toFixed(1)
        )
      : eventoActual?.mediaEstrellas ?? null;

  const { eventosAsistidos, eventosFinalizados, eventoParaResenar } = useMemo(() => {
    const asistidos = actividades.filter(
      (a) => a.negocio === nombreNegocio && misInscripcionesIds.includes(a.id)
    );
    const finalizados = asistidos.filter((a) => esEventoFinalizado(a, ahoraMs));
    const pendientes = finalizados.filter((a) => !misValoracionesEventoIds.includes(a.id));
    const objetivo = usuario
      ? eventoIdObjetivo != null
        ? pendientes.find((a) => Number(a.id) === Number(eventoIdObjetivo)) || null
        : pendientes[0] || null
      : null;
    return {
      eventosAsistidos: asistidos,
      eventosFinalizados: finalizados,
      eventoParaResenar: objetivo,
    };
  }, [
    actividades,
    nombreNegocio,
    misInscripcionesIds,
    ahoraMs,
    misValoracionesEventoIds,
    usuario,
    eventoIdObjetivo,
  ]);

  const yaValoroEste =
    Boolean(usuario) &&
    !eventoParaResenar &&
    (eventoIdObjetivo != null
      ? misValoracionesEventoIds.includes(Number(eventoIdObjetivo))
      : eventosFinalizados.length > 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!texto.trim() || !eventoParaResenar || enviando) return;
    setEnviando(true);
    try {
      const ok = await agregarResena(nombreNegocio, estrellas, texto.trim(), eventoParaResenar.id);
      if (ok !== false) {
        setTexto("");
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <BaseModal
      open={Boolean(modalResenas.open && nombreNegocio)}
      onClose={cerrarModal}
      title={eventoActual ? eventoActual.nombre : `Opiniones: ${nombreNegocio || ""}`}
      subtitle={eventoActual ? nombreNegocio : null}
      maxWidthClass="max-w-md"
      containerClassName="bg-white text-stone-900 rounded-3xl w-full max-h-[90vh] overflow-y-auto p-5 shadow-2xl border-2 border-blue-700 space-y-3"
    >
      <div className="flex items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-3.5 py-2.5">
        <div className="inline-flex items-center gap-1.5">
          <IconStar className="w-5 h-5 text-amber-500" filled />
          <span className="font-black text-base text-stone-900">
            {mediaResenas !== null ? `${Number(mediaResenas).toFixed(1)} / 5` : "Sin nota aún"}
          </span>
        </div>
        <span className="text-xs font-bold text-stone-600">
          {totalResenas === 1 ? "1 reseña" : `${totalResenas} reseñas`}
        </span>
      </div>

      <div className="max-h-44 overflow-y-auto space-y-2 text-sm bg-blue-50 p-3 rounded-2xl border border-blue-200">
        {resenas.length === 0 ? (
          <p className="text-stone-500 text-center py-2">Sin opiniones todavía para esta actividad.</p>
        ) : (
          resenas.map((r, i) => (
            <div key={r.id || i} className="p-2.5 bg-white rounded-xl border border-blue-200">
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

      {eventoParaResenar ? (
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div>
            <label htmlFor="resena-estrellas" className="sr-only">
              Puntuación en estrellas
            </label>
            <select
              id="resena-estrellas"
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
          </div>

          <div>
            <label htmlFor="resena-texto" className="sr-only">
              Tu opinión
            </label>
            <input
              id="resena-texto"
              type="text"
              required
              placeholder="Escribe tu opinión aquí..."
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              className="w-full border-2 border-blue-300 rounded-xl p-2.5 text-base"
            />
          </div>

          <button
            type="submit"
            disabled={enviando}
            className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-black py-3 rounded-2xl shadow"
          >
            {enviando ? "Enviando..." : "Enviar Opinión"}
          </button>
        </form>
      ) : (
        <p className="text-xs sm:text-sm text-blue-950 bg-blue-50 border border-blue-200 p-3 rounded-2xl text-center font-bold">
          {yaValoroEste
            ? "Ya has enviado tu opinión para esta actividad. ¡Gracias!"
            : eventosAsistidos.length > 0
              ? "Podrás dejar tu reseña cuando haya acabado el evento al que te apuntaste."
              : "Solo puedes reseñar si te has apuntado a esta actividad y ya ha acabado."}
        </p>
      )}
    </BaseModal>
  );
}
