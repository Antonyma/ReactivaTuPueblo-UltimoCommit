import React from "react";
import { useApp } from "../context/AppContext.jsx";
import { evaluarFiabilidadNegocio } from "../constants/comarca.js";
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
  const evalRef = evaluarFiabilidadNegocio(act.negocio, cuentasNegocio);

  const libres = Math.max(0, act.aforo - act.asistentes);
  const sinPlazas = libres === 0;
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

  const badgeEstado = act.pendienteSync ? (
    <span className="absolute top-3 right-3 bg-amber-400 text-stone-950 text-xs font-black px-3 py-1 rounded-full shadow">
      ⏳ Guardado sin red
    </span>
  ) : act.estadoModeracion === "pendiente" ? (
    <span className="absolute top-3 right-3 bg-amber-400 text-stone-950 text-xs font-black px-3 py-1 rounded-full">
      En revisión (Nivel 1)
    </span>
  ) : estaTerminado ? (
    <span className="absolute top-3 right-3 bg-emerald-700 text-white text-xs font-black px-3 py-1 rounded-full shadow">
      Finalizado
    </span>
  ) : (
    <span className="absolute top-3 right-3 bg-white/95 text-blue-950 text-xs font-black px-3 py-1 rounded-full">
      {act.dePago ? "De pago" : "Gratis"}
    </span>
  );

  return (
    <article
      id={`actividad-card-${act.id}`}
      className="tarjeta-plan bg-white rounded-3xl overflow-hidden shadow-sm flex flex-col justify-between scroll-mt-24 transition-shadow duration-300"
    >
      <div>
        <div className="relative">
          <img src={act.imagen} alt={act.nombre} className="w-full h-44 sm:h-48 object-cover" />
          <span className="absolute top-3 left-3 bg-blue-950/90 text-white text-xs font-bold px-3 py-1 rounded-full">
            {act.categoria}
          </span>
          {(act.esRecomendada || act.es_recomendada) && (
            <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 bg-amber-400 text-stone-950 text-xs font-black px-2.5 py-1 rounded-full shadow">
              <IconStar className="w-3.5 h-3.5" filled />
              Recomendado
            </span>
          )}
          {badgeEstado}
        </div>

        <div className="p-4 sm:p-5 space-y-2">
          <p className="text-sm font-black text-orange-700 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <IconMapPin className="w-4 h-4 shrink-0" />
              <span>{act.pueblo}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <IconClock className="w-4 h-4 shrink-0" />
              <span>{act.fecha}</span>
            </span>
          </p>
          <h3 className="font-black text-xl leading-snug">{act.nombre}</h3>
          <p className="text-xs font-bold text-stone-500">
            Organiza: {act.negocio} ·{" "}
            <span className="text-emerald-800">Ref. {evalRef.nivel}/3</span>
          </p>
          <p className="text-base text-stone-700">{act.descripcion}</p>
          {(act.esRecomendada || act.es_recomendada) && act.motivoRecomendacion && (
            <p className="text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
              {act.motivoRecomendacion}
            </p>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-5 pt-0">
        {esMia ? (
          <div className="space-y-2">
            {estaTerminado ? (
              <div className="w-full inline-flex items-center justify-center gap-2 bg-emerald-100 text-emerald-950 border border-emerald-300 font-black py-2.5 px-3 rounded-2xl text-xs">
                <IconCheck className="w-4 h-4 shrink-0" />
                <span>Evento terminado · Reseñas habilitadas</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setModalCambiarHora({ open: true, actividad: act })}
                  className="inline-flex items-center justify-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-stone-950 font-black py-3 px-3 rounded-2xl text-xs sm:text-sm shadow-sm"
                >
                  <IconClock className="w-4 h-4 shrink-0" />
                  <span>Cambiar Hora</span>
                </button>
                <button
                  type="button"
                  onClick={() => terminarEvento(act.id)}
                  className="inline-flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black py-3 px-3 rounded-2xl text-xs sm:text-sm shadow-sm"
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
              yaApuntado ? (
                <button
                  type="button"
                  onClick={() =>
                    setModalResenas({ open: true, nombreNegocio: act.negocio, eventoId: act.id })
                  }
                  className={`w-full inline-flex items-center justify-center gap-2 font-black py-3.5 px-4 rounded-2xl shadow ${
                    yaValorado
                      ? "bg-emerald-100 hover:bg-emerald-200 text-emerald-950"
                      : "bg-amber-400 hover:bg-amber-300 text-stone-950"
                  }`}
                >
                  <IconStar className="w-5 h-5 shrink-0" filled />
                  <span>
                    {yaValorado ? "Ya valorado · Ver opiniones" : "Evento terminado · Dejar reseña"}
                  </span>
                </button>
              ) : (
                <button
                  disabled
                  className="w-full bg-stone-400 text-white font-black py-3.5 px-4 rounded-2xl cursor-not-allowed"
                >
                  Evento finalizado
                </button>
              )
            ) : sinPlazas ? (
              <button
                disabled
                className="w-full bg-stone-400 text-white font-black py-3.5 px-4 rounded-2xl cursor-not-allowed"
              >
                Completo
              </button>
            ) : yaApuntado ? (
              <button
                type="button"
                onClick={() => desapuntarse(act.id)}
                className="w-full inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-black py-3.5 px-4 rounded-2xl"
              >
                <IconCheck className="w-5 h-5 shrink-0" />
                <span>
                  {inscripcionPendienteSync ? "⏳ Apuntado (Pendiente de red)" : "Apuntado (Quitar)"}
                </span>
              </button>
            ) : (
              <button
                type="button"
                data-action="apuntar"
                onClick={() => apuntarse(act.id)}
                className="w-full bg-blue-700 hover:bg-blue-800 text-white font-black py-3.5 px-4 rounded-2xl shadow"
              >
                Apuntarme (Quedan {libres})
              </button>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setModalDudas({ open: true, actividad: act })}
                className="inline-flex items-center justify-center gap-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 font-bold py-2.5 px-3 rounded-xl text-sm"
              >
                <IconMessage className="w-4 h-4 shrink-0" />
                <span>Dudas WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setModalResenas({ open: true, nombreNegocio: act.negocio, eventoId: act.id })
                }
                className="inline-flex items-center justify-center gap-1.5 bg-blue-100 hover:bg-blue-200 text-blue-950 font-bold py-2.5 px-3 rounded-xl text-sm"
              >
                <IconStar className="w-4 h-4 shrink-0" filled />
                <span>Ref. {evalRef.nivel}/3</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
