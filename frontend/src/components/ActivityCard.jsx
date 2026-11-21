import React from "react";
import { useApp } from "../context/AppContext.jsx";
import { evaluarFiabilidadNegocio } from "../data/mockData.js";

export default function ActivityCard({ act }) {
  const {
    usuario,
    cuentasNegocio,
    misInscripcionesIds,
    apuntarse,
    desapuntarse,
    eliminarEvento,
    setModalCambiarHora,
    setModalDudas,
    setModalResenas,
    setModalInscritos
  } = useApp();

  const esPublicador = usuario && usuario.tipoUsuario === "PUBLICADOR";
  const esMia = esPublicador && Boolean(cuentasNegocio[act.negocio]?.esMio);
  const evalRef = evaluarFiabilidadNegocio(act.negocio, cuentasNegocio);

  const libres = Math.max(0, act.aforo - act.asistentes);
  const sinPlazas = libres === 0;
  const yaApuntado = misInscripcionesIds.includes(act.id);

  const badgeEstado =
    act.estadoModeracion === "pendiente" ? (
      <span className="absolute top-3 right-3 bg-amber-400 text-stone-950 text-xs font-black px-3 py-1 rounded-full">
        ⏳ En revisión (Nivel 1)
      </span>
    ) : (
      <span className="absolute top-3 right-3 bg-white/95 text-blue-950 text-xs font-black px-3 py-1 rounded-full">
        {act.dePago ? "💶 De pago" : "🎟️ Gratis"}
      </span>
    );

  return (
    <article className="tarjeta-plan bg-white rounded-3xl overflow-hidden shadow-sm flex flex-col justify-between">
      <div>
        <div className="relative">
          <img src={act.imagen} alt={act.nombre} className="w-full h-48 object-cover" />
          <span className="absolute top-3 left-3 bg-blue-950/90 text-white text-xs font-bold px-3 py-1 rounded-full">
            {act.categoria}
          </span>
          {badgeEstado}
        </div>

        <div className="p-5 space-y-2">
          <p className="text-sm font-black text-orange-700">
            📍 {act.pueblo} · 🕒 {act.fecha}
          </p>
          <h3 className="font-black text-xl leading-snug">{act.nombre}</h3>
          <p className="text-xs font-bold text-stone-500">
            Organiza: {act.negocio} ·{" "}
            <span className="text-emerald-800">Ref. {evalRef.nivel}/3</span>
          </p>
          <p className="text-base text-stone-700">{act.descripcion}</p>
        </div>
      </div>

      <div className="p-5 pt-0">
        {esMia ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setModalCambiarHora({ open: true, actividad: act })}
              className="w-full bg-amber-400 hover:bg-amber-300 text-stone-950 font-black py-3 px-3 rounded-2xl text-sm shadow-sm"
            >
              🕒 Cambiar Hora
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setModalInscritos({ open: true, actividad: act })}
                className="bg-blue-950 hover:bg-blue-900 text-white font-bold py-2.5 px-3 rounded-2xl text-xs"
              >
                👥 Apuntados ({act.asistentes})
              </button>
              <button
                type="button"
                onClick={() => eliminarEvento(act.id)}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-3 rounded-2xl text-xs"
              >
                🗑️ Borrar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {sinPlazas ? (
              <button disabled className="w-full bg-stone-400 text-white font-black py-3.5 px-4 rounded-2xl cursor-not-allowed">
                🚫 Completo
              </button>
            ) : yaApuntado ? (
              <button
                type="button"
                onClick={() => desapuntarse(act.id)}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black py-3.5 px-4 rounded-2xl"
              >
                ✅ Ya estás apuntado (Quitar)
              </button>
            ) : (
              <button
                type="button"
                onClick={() => apuntarse(act.id)}
                className="w-full bg-blue-700 hover:bg-blue-800 text-white font-black py-3.5 px-4 rounded-2xl shadow"
              >
                👉 Apuntarme (Quedan {libres})
              </button>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setModalDudas({ open: true, actividad: act })}
                className="bg-emerald-100 hover:bg-emerald-200 text-emerald-950 font-bold py-2.5 px-3 rounded-xl text-sm"
              >
                💬 Dudas WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setModalResenas({ open: true, nombreNegocio: act.negocio })}
                className="bg-blue-100 hover:bg-blue-200 text-blue-950 font-bold py-2.5 px-3 rounded-xl text-sm"
              >
                ⭐ Ref. {evalRef.nivel}/3
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
