import React from "react";
import { useApp } from "../context/AppContext.jsx";
import {
  IconCheck,
  IconClock,
  IconMapPin,
  IconMessage,
  IconStar,
  IconTrash,
  IconUsers,
} from "./Icons.jsx";

export default function ActivityCard({ act }) {
  const {
    usuario,
    cuentasNegocio,
    misInscripcionesIds,
    misValoracionesEventoIds,
    inscripcionesPendientesIds,
    apuntarse,
    desapuntarse,
    eliminarEvento,
    terminarEvento,
    setModalCambiarHora,
    setModalDudas,
    setModalResenas,
    setModalInscritos,
  } = useApp();

  const esPublicador = usuario && usuario.tipoUsuario === "PUBLICADOR";
  const esMia = esPublicador && Boolean(cuentasNegocio[act.negocio]?.esMio);

  const esAforoLibre = Number(act.aforo || 0) <= 0;
  const libres = Math.max(0, act.aforo - act.asistentes);
  const sinPlazas = !esAforoLibre && libres === 0;
  const yaApuntado = misInscripcionesIds.includes(act.id);
  const yaValorado = misValoracionesEventoIds.includes(act.id);
  const inscripcionPendienteSync = inscripcionesPendientesIds.includes(act.id);
  const finMs =
    typeof act.fechaFinMs === "number"
      ? act.fechaFinMs
      : act.fechaFinISO
        ? new Date(act.fechaFinISO).getTime()
        : NaN;
  const estaTerminado = !Number.isNaN(finMs) && finMs <= Date.now();
  const esRecomendada = Boolean(act.esRecomendada || act.es_recomendada);

  const badgeEstado = act.pendienteSync ? (
    <span className="absolute top-3 right-3 bg-amber-400 text-stone-950 text-xs font-black px-3 py-1 rounded-full shadow-sm">
      ⏳ Sin red
    </span>
  ) : act.estadoModeracion === "pendiente" ? (
    <span className="absolute top-3 right-3 bg-amber-400 text-stone-950 text-xs font-black px-3 py-1 rounded-full shadow-sm">
      En revisión
    </span>
  ) : estaTerminado ? (
    <span className="absolute top-3 right-3 bg-emerald-700 text-white text-xs font-black px-3 py-1 rounded-full shadow-sm">
      Finalizado
    </span>
  ) : (
    <span className="absolute top-3 right-3 bg-white/95 text-blue-950 text-xs font-black px-3 py-1 rounded-full shadow-sm">
      {act.dePago ? "De pago" : "Gratis"}
    </span>
  );

  return (
    <article
      id={`actividad-card-${act.id}`}
      className="tarjeta-plan bg-white rounded-3xl overflow-hidden flex flex-col justify-between scroll-mt-24 transition-all duration-200"
    >
      <div>
        <div className="relative">
          <img src={act.imagen} alt={act.nombre} className="w-full h-44 sm:h-48 object-cover" />
          <span className="absolute top-3 left-3 bg-blue-950/90 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
            {act.categoria}
          </span>
          {badgeEstado}
        </div>

        <div className="p-4 sm:p-5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs sm:text-sm font-extrabold text-orange-700 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="inline-flex items-center gap-1">
                <IconMapPin className="w-3.5 h-3.5 shrink-0" />
                <span>{act.pueblo}</span>
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <IconClock className="w-3.5 h-3.5 shrink-0" />
                <span>{act.fecha}</span>
              </span>
            </p>
            {esRecomendada && (
              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-black px-2.5 py-0.5 rounded-full">
                <IconStar className="w-3 h-3 text-amber-500" filled />
                <span>Para ti</span>
              </span>
            )}
          </div>

          <div>
            <h3 className="font-black text-lg sm:text-xl leading-snug text-stone-900">
              {act.nombre}
            </h3>
            <p className="text-xs font-semibold text-stone-500 mt-0.5">
              Organiza: {act.negocio}
            </p>
          </div>

          <p className="text-sm sm:text-base text-stone-700 line-clamp-2 leading-relaxed">
            {act.descripcion}
          </p>

          {esRecomendada && act.motivoRecomendacion && (
            <p className="text-xs font-semibold text-amber-900 bg-amber-50/80 border border-amber-200 rounded-xl px-3 py-1.5 line-clamp-2">
              {act.motivoRecomendacion}
            </p>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-5 pt-0">
        {esMia ? (
          <div className="space-y-2">
            {estaTerminado ? (
              <div className="w-full inline-flex items-center justify-center gap-2 bg-emerald-50 text-emerald-900 border border-emerald-200 font-black py-2.5 px-3 rounded-2xl text-xs">
                <IconCheck className="w-4 h-4 shrink-0" />
                <span>Evento terminado · Reseñas habilitadas</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setModalCambiarHora({ open: true, actividad: act })}
                  className="inline-flex items-center justify-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-stone-950 font-black py-2.5 px-3 rounded-2xl text-xs sm:text-sm"
                >
                  <IconClock className="w-4 h-4 shrink-0" />
                  <span>Cambiar Hora</span>
                </button>
                <button
                  type="button"
                  onClick={() => terminarEvento(act.id)}
                  className="inline-flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black py-2.5 px-3 rounded-2xl text-xs sm:text-sm"
                >
                  <IconCheck className="w-4 h-4 shrink-0" />
                  <span>Terminar</span>
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setModalInscritos({ open: true, actividad: act })}
                className="inline-flex items-center justify-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-bold py-2.5 px-3 rounded-2xl text-xs"
              >
                <IconUsers className="w-4 h-4 shrink-0" />
                <span>Apuntados ({act.asistentes})</span>
              </button>
              <button
                type="button"
                onClick={() => eliminarEvento(act.id)}
                className="inline-flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-3 rounded-2xl text-xs"
              >
                <IconTrash className="w-4 h-4 shrink-0" />
                <span>Borrar</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {estaTerminado ? (
              <div className="w-full text-center bg-stone-100 text-stone-600 border border-stone-200 font-bold py-3 px-4 rounded-2xl text-sm">
                Evento finalizado
              </div>
            ) : esAforoLibre ? (
              <div className="w-full text-center bg-sky-50 text-blue-900 border border-sky-200 font-bold py-3 px-4 rounded-2xl text-sm">
                Acceso libre · Sin inscripción
              </div>
            ) : sinPlazas ? (
              <button
                disabled
                className="w-full bg-stone-300 text-stone-700 font-black py-3 px-4 rounded-2xl cursor-not-allowed text-sm"
              >
                Aforo completo
              </button>
            ) : yaApuntado ? (
              <button
                type="button"
                onClick={() => desapuntarse(act.id)}
                className="w-full inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-black py-3 px-4 rounded-2xl text-sm sm:text-base transition"
              >
                <IconCheck className="w-5 h-5 shrink-0" />
                <span>
                  {inscripcionPendienteSync ? "⏳ Apuntado (Sin red)" : "Apuntado · Quitar"}
                </span>
              </button>
            ) : (
              <button
                type="button"
                data-action="apuntar"
                onClick={() => apuntarse(act.id)}
                className="w-full bg-blue-700 hover:bg-blue-800 text-white font-black py-3 px-4 rounded-2xl shadow-sm text-sm sm:text-base transition"
              >
                Apuntarme ({libres} {libres === 1 ? "plaza" : "plazas"})
              </button>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setModalDudas({ open: true, actividad: act })}
                className="flex-1 inline-flex items-center justify-center gap-1.5 bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-300 font-bold py-2.5 px-3 rounded-xl text-sm transition"
              >
                <IconMessage className="w-4 h-4 shrink-0 text-emerald-700" />
                <span>Dudas WhatsApp</span>
              </button>
              {yaApuntado && estaTerminado && (
                <button
                  type="button"
                  onClick={() =>
                    setModalResenas({ open: true, nombreNegocio: act.negocio, eventoId: act.id })
                  }
                  title={yaValorado ? "Ya valorado · Ver opiniones" : "Valorar este evento"}
                  aria-label={yaValorado ? "Ya valorado · Ver opiniones" : "Valorar este evento"}
                  className={`inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0 shadow-sm transition ${
                    yaValorado
                      ? "bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border border-emerald-300"
                      : "bg-amber-400 hover:bg-amber-300 text-stone-950"
                  }`}
                >
                  <IconStar className="w-5 h-5" filled />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
