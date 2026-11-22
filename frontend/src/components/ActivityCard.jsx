import React from "react";
import { useApp } from "../context/useApp.js";
import { useNow } from "../hooks/useNow.js";
import { DEFAULT_IMAGE, esEventoFinalizado } from "../utils/eventUtils.js";
import {
  IconCheck,
  IconClock,
  IconMapPin,
  IconMessage,
  IconStar,
  IconTrash,
  IconUsers,
} from "./Icons.jsx";

const ActivityCard = React.memo(function ActivityCard({ act }) {
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
  const ahoraMs = useNow(60000);
  const estaTerminado = esEventoFinalizado(act, ahoraMs);
  const esRecomendada = !estaTerminado && Boolean(act.esRecomendada || act.es_recomendada);

  const handleTerminar = () => {
    if (window.confirm(`¿Marcar "${act.nombre}" como finalizado? Se habilitarán las reseñas.`)) {
      terminarEvento(act.id);
    }
  };

  const handleEliminar = () => {
    if (window.confirm(`¿Eliminar permanentemente la actividad "${act.nombre}"?`)) {
      eliminarEvento(act.id);
    }
  };

  const badgeEstado = act.pendienteSync ? (
    <span className="bg-amber-400 text-stone-950 text-[11px] font-extrabold uppercase tracking-wide px-2.5 py-0.5 rounded-sm">
      Sin red
    </span>
  ) : act.estadoModeracion === "pendiente" ? (
    <span className="bg-amber-400 text-stone-950 text-[11px] font-extrabold uppercase tracking-wide px-2.5 py-0.5 rounded-sm">
      En revisión
    </span>
  ) : estaTerminado ? (
    <span className="bg-[#3D5A3C] text-white text-[11px] font-extrabold uppercase tracking-wide px-2.5 py-0.5 rounded-sm">
      Finalizado
    </span>
  ) : (
    <span className="bg-white/95 text-[#16324F] text-[11px] font-extrabold uppercase tracking-wide px-2.5 py-0.5 rounded-sm border border-[#D6D3CD]">
      {act.dePago ? "De pago" : "Gratis"}
    </span>
  );

  const ocupacionPct =
    !esAforoLibre && act.aforo > 0
      ? Math.min(100, Math.round((Number(act.asistentes || 0) / Number(act.aforo)) * 100))
      : 0;

  return (
    <article
      id={`actividad-card-${act.id}`}
      className="tarjeta-plan bg-white rounded-2xl overflow-hidden flex flex-col justify-between scroll-mt-24"
    >
      <div>
        <div className="relative border-b border-[#E5E2DC] overflow-hidden">
          <img
            src={act.imagen || DEFAULT_IMAGE}
            alt={act.nombre}
            loading="lazy"
            decoding="async"
            onError={(e) => {
              if (e.currentTarget.src !== DEFAULT_IMAGE) {
                e.currentTarget.src = DEFAULT_IMAGE;
              }
            }}
            className="w-full h-48 sm:h-52 object-cover bg-stone-100"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/40 to-transparent"
            aria-hidden="true"
          />
          <span className="absolute top-3 left-3 bg-[#2F5233]/95 backdrop-blur-xs text-white text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-lg shadow-sm">
            {act.categoria}
          </span>
          <div className="absolute top-3 right-3">{badgeEstado}</div>
        </div>

        <div className="p-4 sm:p-5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EFECE6] pb-2">
            <p className="text-xs font-bold uppercase tracking-wide text-[#9A410E] flex flex-wrap items-center gap-x-2 gap-y-1">
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
              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-950 border border-amber-400 text-[11px] font-bold uppercase px-2 py-0.5 rounded-sm">
                <IconStar className="w-3 h-3 text-amber-600" filled />
                <span>Recomendado</span>
              </span>
            )}
          </div>

          <div>
            <h3 className="font-bold text-lg sm:text-xl leading-snug text-[#16324F]">
              {act.nombre}
            </h3>
            <div className="flex flex-wrap items-center justify-between gap-2 mt-1">
              <p className="text-xs font-semibold text-stone-500">
                Organiza: {act.negocio}
              </p>
              {(act.totalValoraciones > 0 || estaTerminado) && (
                <button
                  type="button"
                  onClick={() =>
                    setModalResenas({ open: true, nombreNegocio: act.negocio, eventoId: act.id })
                  }
                  className="inline-flex items-center gap-1 bg-[#F4F3EF] hover:bg-[#EAE8E1] border border-[#D6D3CD] text-[#16324F] text-xs font-bold px-2 py-0.5 rounded-sm transition"
                  title="Ver reseñas y nota media"
                >
                  <IconStar className="w-3.5 h-3.5 text-amber-600" filled />
                  {act.totalValoraciones > 0 ? (
                    <span>
                      {Number(act.mediaEstrellas).toFixed(1)}/5 ({act.totalValoraciones})
                    </span>
                  ) : (
                    <span className="font-semibold text-stone-600">Sin reseñas</span>
                  )}
                </button>
              )}
            </div>
          </div>

          <p className="text-sm text-stone-700 line-clamp-2 leading-relaxed">
            {act.descripcion}
          </p>

          {esRecomendada && act.motivoRecomendacion && (
            <p className="text-xs font-semibold text-[#16324F] bg-[#F4F3EF] border-l-4 border-[#C85A17] rounded-r-lg px-3 py-1.5 line-clamp-2">
              {act.motivoRecomendacion}
            </p>
          )}

          {!estaTerminado && !esAforoLibre && (
            <div className="pt-1 space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-[#5E564D]">
                <span>Plazas ocupadas</span>
                <span>
                  {act.asistentes}/{act.aforo}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-[#EAE8E1] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    sinPlazas
                      ? "bg-[#7F1D1D]"
                      : ocupacionPct >= 75
                        ? "bg-[#C85A17]"
                        : "bg-[#3D5A3C]"
                  }`}
                  style={{ width: `${ocupacionPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-5 pt-0">
        {esMia ? (
          <div className="space-y-2">
            {estaTerminado ? (
              <div className="w-full inline-flex items-center justify-center gap-2 bg-[#EEF3EC] text-[#2F5233] border border-[#C2D1BC] font-bold py-2 px-3 rounded text-xs">
                <IconCheck className="w-4 h-4 shrink-0" />
                <span>Evento terminado · Reseñas habilitadas</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setModalCambiarHora({ open: true, actividad: act })}
                  className="inline-flex items-center justify-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold py-2 px-3 rounded text-xs sm:text-sm"
                >
                  <IconClock className="w-4 h-4 shrink-0" />
                  <span>Cambiar Hora</span>
                </button>
                <button
                  type="button"
                  onClick={handleTerminar}
                  className="inline-flex items-center justify-center gap-1.5 bg-[#3D5A3C] hover:bg-[#2F472E] text-white font-bold py-2 px-3 rounded text-xs sm:text-sm"
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
                className="inline-flex items-center justify-center gap-1.5 bg-[#16324F] hover:bg-[#1E4268] text-white font-bold py-2 px-3 rounded text-xs"
              >
                <IconUsers className="w-4 h-4 shrink-0" />
                <span>Apuntados ({act.asistentes})</span>
              </button>
              <button
                type="button"
                onClick={handleEliminar}
                className="inline-flex items-center justify-center gap-1.5 bg-[#7F1D1D] hover:bg-[#991B1B] text-white font-bold py-2 px-3 rounded text-xs"
              >
                <IconTrash className="w-4 h-4 shrink-0" />
                <span>Borrar</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {estaTerminado ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="text-center bg-[#F4F3EF] text-stone-600 border border-[#D6D3CD] font-bold py-2.5 px-3 rounded text-xs sm:text-sm flex items-center justify-center">
                  Evento finalizado
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setModalResenas({ open: true, nombreNegocio: act.negocio, eventoId: act.id })
                  }
                  className="inline-flex items-center justify-center gap-1.5 bg-[#16324F] hover:bg-[#1E4268] text-white font-bold py-2.5 px-3 rounded text-xs sm:text-sm transition"
                >
                  <IconStar className="w-4 h-4 text-amber-300 shrink-0" filled />
                  <span>Reseñas y fotos</span>
                </button>
              </div>
            ) : esAforoLibre ? (
              <div className="w-full text-center bg-[#EFF4F8] text-[#16324F] border border-[#C6D4E1] font-bold py-2.5 px-4 rounded text-sm">
                Acceso libre · Sin inscripción
              </div>
            ) : sinPlazas ? (
              <button
                disabled
                className="w-full bg-stone-200 text-stone-700 font-bold py-2.5 px-4 rounded cursor-not-allowed text-sm"
              >
                Aforo completo
              </button>
            ) : yaApuntado ? (
              <button
                type="button"
                onClick={() => desapuntarse(act.id)}
                className="w-full inline-flex items-center justify-center gap-2 bg-[#3D5A3C] hover:bg-[#2F472E] text-white font-bold py-2.5 px-4 rounded text-sm sm:text-base transition"
              >
                <IconCheck className="w-5 h-5 shrink-0" />
                <span>
                  {inscripcionPendienteSync ? "Apuntado (Sin red)" : "Apuntado · Quitar"}
                </span>
              </button>
            ) : (
              <button
                type="button"
                data-action="apuntar"
                onClick={() => apuntarse(act.id)}
                className="w-full bg-[#C85A17] hover:bg-[#AD4B10] text-white font-bold py-2.5 px-4 rounded text-sm sm:text-base transition"
              >
                Apuntarme ({libres} {libres === 1 ? "plaza" : "plazas"})
              </button>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setModalDudas({ open: true, actividad: act })}
                className="flex-1 inline-flex items-center justify-center gap-1.5 bg-white hover:bg-[#F4F3EF] text-[#16324F] border border-[#C9C4BA] font-bold py-2 px-3 rounded text-sm transition"
              >
                <IconMessage className="w-4 h-4 shrink-0 text-[#3D5A3C]" />
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
                  className={`inline-flex items-center justify-center w-10 h-10 rounded shrink-0 transition ${
                    yaValorado
                      ? "bg-[#EEF3EC] hover:bg-[#DCE7D8] text-[#2F5233] border border-[#B7C9B0]"
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
});

export default ActivityCard;
