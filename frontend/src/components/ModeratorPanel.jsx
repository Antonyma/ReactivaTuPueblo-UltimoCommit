import React from "react";
import { useApp } from "../context/AppContext.jsx";
import { evaluarFiabilidadNegocio } from "../constants/comarca.js";
import {
  IconArrowLeft,
  IconCheck,
  IconClock,
  IconClose,
  IconMapPin,
  IconShield,
} from "./Icons.jsx";

export default function ModeratorPanel() {
  const {
    actividades,
    cuentasNegocio,
    muestrasAprendidasModelo,
    eventosAhorradosTokens,
    ultimoWhatsAppPublicador,
    aprobarActividad,
    denegarActividad,
    aprobarNegocio,
    denegarNegocio,
    cambiarRol,
  } = useApp();

  const pendientes = actividades.filter((a) => a.estadoModeracion === "pendiente");
  const aprobadas = actividades.filter((a) => a.estadoModeracion === "aprobada");
  const denegadas = actividades.filter((a) => a.estadoModeracion === "denegada");
  const negociosPendientes = Object.values(cuentasNegocio).filter((n) => n.pendiente);

  const precision = Math.min(99, 91 + Math.floor(muestrasAprendidasModelo / 2));

  return (
    <section id="vista-exclusiva-moderador" className="space-y-6">
      {/* Banner Resumen Métricas */}
      <div className="caja-panel panel-moderador-banner bg-blue-950 text-white p-4 sm:p-6 rounded-3xl shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-blue-800 pb-4">
          <div className="min-w-0">
            <span className="bg-amber-400 text-stone-950 text-xs font-black uppercase px-3 py-1 rounded-full inline-block">
              Acceso Exclusivo · Rol Moderador
            </span>
            <h1 className="text-xl sm:text-3xl font-black mt-2 flex items-center gap-2">
              <IconShield className="w-6 h-6 sm:w-7 sm:h-7 text-amber-400 shrink-0" />
              <span>Panel de Moderación, Referencia y Aprendizaje</span>
            </h1>
            <p className="text-sm text-blue-100 mt-1">
              Los negocios con <strong>Referencia Nivel 2 o 3</strong> pasan directos con{" "}
              <strong>0 tokens</strong>. Solo revisas cuentas nuevas (Nivel 1), entrenando el modelo y
              notificando por WhatsApp al publicador.
            </p>
          </div>
          <button
            type="button"
            onClick={() => cambiarRol("REGISTRADO")}
            className="inline-flex items-center justify-center gap-2 bg-white hover:bg-blue-50 text-blue-950 font-black px-5 py-3 rounded-2xl text-sm shrink-0 shadow w-full sm:w-auto"
          >
            <IconArrowLeft className="w-4 h-4" />
            <span>Salir de Moderador</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-blue-900/70 p-4 rounded-2xl border border-blue-700">
            <p className="text-xs text-blue-200 uppercase font-bold">Muestras aprendidas por el modelo</p>
            <p className="text-3xl font-black text-amber-400 mt-1">{muestrasAprendidasModelo}</p>
            <p className="text-xs text-blue-100 mt-1">
              Precisión actual: <strong className="text-emerald-300">{precision}%</strong>
            </p>
          </div>
          <div className="bg-blue-900/70 p-4 rounded-2xl border border-blue-700">
            <p className="text-xs text-blue-200 uppercase font-bold">Tokens ahorrados por Referencia</p>
            <p className="text-3xl font-black text-emerald-300 mt-1">{eventosAhorradosTokens} eventos</p>
            <p className="text-xs text-blue-100 mt-1">Negocios Nivel 2/3 pasan directos</p>
          </div>
          <div className="bg-blue-900/70 p-4 rounded-2xl border border-blue-700">
            <p className="text-xs text-blue-200 uppercase font-bold">Último WhatsApp enviado al Publicador</p>
            <p className="text-xs font-bold text-amber-200 mt-1.5 leading-snug">
              {ultimoWhatsAppPublicador}
            </p>
          </div>
        </div>
      </div>

      {/* COMERCIOS PENDIENTES DE CONFIRMACIÓN */}
      <div className="caja-panel bg-white p-4 sm:p-6 rounded-3xl shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg sm:text-xl font-black">Comercios Pendientes de Confirmación</h2>
            <p className="text-sm text-stone-600">
              Los comercios recién registrados permanecen pendientes hasta que los confirmes.
            </p>
          </div>
          <span className="bg-amber-400 text-stone-950 font-black px-3.5 py-1.5 rounded-full text-sm shrink-0">
            {negociosPendientes.length}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {negociosPendientes.length === 0 ? (
            <div className="col-span-full bg-blue-50 border border-blue-200 rounded-2xl p-5 text-center text-sm text-stone-600">
              No hay comercios pendientes de confirmación ahora mismo.
            </div>
          ) : (
            negociosPendientes.map((neg) => (
              <article
                key={neg.id || neg.nombre}
                className="border-2 border-amber-400 bg-amber-50/40 rounded-2xl p-4 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1">
                  <span className="bg-amber-200 text-amber-950 text-xs font-black px-2.5 py-0.5 rounded-full inline-block">
                    Pendiente
                  </span>
                  <h3 className="font-black text-base text-stone-900">{neg.nombre}</h3>
                  <p className="text-xs font-bold text-stone-600 inline-flex items-center gap-1">
                    <IconMapPin className="w-3.5 h-3.5 shrink-0" />
                    <span>{neg.pueblo}</span>
                  </p>
                  {neg.propietarioNombre && (
                    <p className="text-xs text-stone-700">Propietario: {neg.propietarioNombre}</p>
                  )}
                  {(neg.instagramUrl || neg.facebookUrl) && (
                    <p className="text-xs text-blue-900 break-all">
                      {neg.instagramUrl || neg.facebookUrl}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => aprobarNegocio(neg.nombre)}
                    className="inline-flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black py-2.5 rounded-xl text-sm"
                  >
                    <IconCheck className="w-4 h-4 shrink-0" />
                    <span>Confirmar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => denegarNegocio(neg.nombre)}
                    className="inline-flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-black py-2.5 rounded-xl text-sm"
                  >
                    <IconClose className="w-4 h-4 shrink-0" />
                    <span>Denegar</span>
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      {/* DISPLAY 1: PENDIENTES */}
      <div className="caja-panel bg-white p-4 sm:p-6 rounded-3xl shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg sm:text-xl font-black">1. Pendientes de Moderación (Cuentas Nivel 1)</h2>
            <p className="text-sm text-stone-600">
              Al aprobar o denegar se envía WhatsApp al publicador y sube su nivel de referencia si es válida.
            </p>
          </div>
          <span className="bg-amber-400 text-stone-950 font-black px-3.5 py-1.5 rounded-full text-sm shrink-0">
            {pendientes.length}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {pendientes.length === 0 ? (
            <div className="col-span-full bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center text-sm text-stone-600">
              No hay actividades pendientes ahora mismo. Las cuentas con Referencia Nivel 2 o 3 pasan automáticamente sin gastar tokens.
            </div>
          ) : (
            pendientes.map((act) => {
              const evalRef = evaluarFiabilidadNegocio(act.negocio, cuentasNegocio);
              return (
                <article
                  key={act.id}
                  className="border-2 border-amber-400 bg-amber-50/40 rounded-2xl overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    <img src={act.imagen} alt={act.nombre} className="w-full h-40 object-cover" />
                    <div className="p-4 space-y-1.5">
                      <span className="bg-amber-200 text-amber-950 text-xs font-black px-2.5 py-0.5 rounded-full inline-block">
                        Nivel Referencia {evalRef.nivel}/3
                      </span>
                      <h3 className="font-black text-base text-stone-900">{act.nombre}</h3>
                      <p className="text-xs font-bold text-stone-600 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="inline-flex items-center gap-1">
                          <IconMapPin className="w-3.5 h-3.5 shrink-0" />
                          <span>{act.pueblo}</span>
                        </span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <IconClock className="w-3.5 h-3.5 shrink-0" />
                          <span>{act.fecha}</span>
                        </span>
                      </p>
                      <p className="text-xs text-stone-700">{act.descripcion}</p>
                    </div>
                  </div>
                  <div className="p-4 pt-0 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => aprobarActividad(act.id)}
                      className="inline-flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black py-3 rounded-xl text-sm"
                    >
                      <IconCheck className="w-4 h-4 shrink-0" />
                      <span>Aprobar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => denegarActividad(act.id)}
                      className="inline-flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-black py-3 rounded-xl text-sm"
                    >
                      <IconClose className="w-4 h-4 shrink-0" />
                      <span>Denegar</span>
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>

      {/* DISPLAY 2 Y 3: APROBADAS Y DENEGADAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Aprobadas */}
        <div className="caja-panel bg-white p-4 sm:p-6 rounded-3xl shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-emerald-950">2. Actividades Aprobadas</h2>
              <p className="text-xs text-stone-600">
                Incluye pase directo por Referencia (0 tokens) y aprobadas por Moderador.
              </p>
            </div>
            <span className="bg-emerald-600 text-white font-black px-3.5 py-1.5 rounded-full text-sm shrink-0">
              {aprobadas.length}
            </span>
          </div>

          <div className="space-y-3 max-h-[450px] overflow-y-auto">
            {aprobadas.map((act) => (
              <div
                key={act.id}
                className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-2xl flex items-center gap-3"
              >
                <img src={act.imagen} alt={act.nombre} className="w-16 h-16 object-cover rounded-xl shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                    <p className="font-black text-sm text-stone-900 truncate">{act.nombre}</p>
                    {act.ahorroTokens ? (
                      <span className="bg-emerald-700 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                        0 TOKENS (Confianza)
                      </span>
                    ) : (
                      <span className="bg-blue-950 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Validada por Moderador
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-600 inline-flex items-center gap-1 flex-wrap">
                    <span>{act.pueblo} ·</span>
                    <IconClock className="w-3.5 h-3.5 shrink-0" />
                    <span>{act.fecha}</span>
                  </p>
                  <p className="text-[11px] font-bold text-emerald-800 mt-0.5">{act.motivoIA || "Validada"}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Denegadas */}
        <div className="caja-panel bg-white p-4 sm:p-6 rounded-3xl shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-red-950">3. Actividades Denegadas</h2>
              <p className="text-xs text-stone-600">
                Bloqueadas con aviso de rechazo enviado por WhatsApp al publicador.
              </p>
            </div>
            <span className="bg-red-600 text-white font-black px-3.5 py-1.5 rounded-full text-sm shrink-0">
              {denegadas.length}
            </span>
          </div>

          <div className="space-y-3 max-h-[450px] overflow-y-auto">
            {denegadas.map((act) => (
              <div
                key={act.id}
                className="p-3 bg-red-50/60 border border-red-200 rounded-2xl flex items-center gap-3"
              >
                <img
                  src={act.imagen}
                  alt={act.nombre}
                  className="w-16 h-16 object-cover rounded-xl grayscale shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-black text-sm text-stone-900 truncate">{act.nombre}</p>
                  <p className="text-xs text-stone-600">
                    {act.pueblo} · {act.negocio}
                  </p>
                  <p className="text-[11px] font-bold text-red-800 mt-0.5">{act.motivoIA || "Denegada"}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
