import React, { useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { evaluarFiabilidadNegocio } from "../data/mockData.js";

export default function ModeratorPanel() {
  const {
    actividades,
    cuentasNegocio,
    resenas,
    muestrasAprendidasModelo,
    eventosAhorradosTokens,
    ultimoWhatsAppPublicador,
    aprobarActividad,
    denegarActividad,
    ejecutarModeradorAutonomoEnTodas,
    eliminarResena,
    restaurarResena,
    cambiarRol
  } = useApp();

  const [tabActiva, setTabActiva] = useState("imagenes"); // "imagenes" | "resenas"

  const pendientes = actividades.filter((a) => a.estadoModeracion === "pendiente");
  const aprobadas = actividades.filter((a) => a.estadoModeracion === "aprobada");
  const denegadas = actividades.filter((a) => a.estadoModeracion === "denegada");

  const resenasAprobadas = (resenas || []).filter((r) => r.estado === "aprobada");
  const resenasBloqueadas = (resenas || []).filter((r) => r.estado === "rechazada" || r.contieneMalasPalabras);

  const precision = Math.min(99, 91 + Math.floor(muestrasAprendidasModelo / 2));

  return (
    <section id="vista-exclusiva-moderador" className="space-y-6">
      {/* Banner Superior Principal del Moderador */}
      <div
        className="caja-panel bg-blue-950 text-white p-6 rounded-3xl shadow-lg space-y-4"
        style={{ backgroundColor: "#0B2545 !important", color: "#FFFFFF !important" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-blue-800 pb-4">
          <div>
            <span className="bg-amber-400 text-stone-950 text-xs font-black uppercase px-3 py-1 rounded-full">
              Acceso Exclusivo · Rol Moderador Global
            </span>
            <h1 className="text-2xl sm:text-3xl font-black mt-2">
              🛡️ Panel de Moderación Total con Modelos Gemini
            </h1>
            <p className="text-sm text-blue-100 mt-1 max-w-3xl">
              Moderas todo el contenido comarcal con los micro-agentes de <code>ai-agents</code>: <strong>Imágenes de eventos</strong> evaluadas por el{" "}
              <strong>modelo preentrenado de visión (<code>gemini-2.5-flash-vision</code>)</strong>, el cual juzga a cualquier publicador de forma independiente{" "}
              y <strong>solo deja pasar fotos relacionadas con las categorías oficiales</strong> ('Fiesta Patronal', 'Deportes', 'Gastronomía', 'Turismo', 'Comercio').{" "}
              Además, <strong>penalización estricta</strong> por palabras malsonantes en <strong>reseñas</strong> y <strong>títulos de actividades</strong>.
            </p>
          </div>
          <button
            type="button"
            onClick={() => cambiarRol("REGISTRADO")}
            className="bg-white hover:bg-blue-50 text-blue-950 font-black px-5 py-3 rounded-2xl text-sm shrink-0 shadow"
          >
            ← Salir de Moderador
          </button>
        </div>

        {/* Métricas clave */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-blue-900/70 p-4 rounded-2xl border border-blue-700">
            <p className="text-xs text-blue-200 uppercase font-bold">Muestras aprendidas por el modelo</p>
            <p className="text-3xl font-black text-amber-400 mt-1">{muestrasAprendidasModelo}</p>
            <p className="text-xs text-blue-100 mt-1">
              Precisión de decisión: <strong className="text-emerald-300">{precision}%</strong>
            </p>
          </div>
          <div className="bg-blue-900/70 p-4 rounded-2xl border border-blue-700">
            <p className="text-xs text-blue-200 uppercase font-bold">Filtro Visión Preentrenado</p>
            <p className="text-3xl font-black text-emerald-300 mt-1">
              5 <span className="text-sm font-bold text-white">categorías</span>
            </p>
            <p className="text-xs text-blue-100 mt-1">ai-agents · Juicio imparcial</p>
          </div>
          <div className="bg-blue-900/70 p-4 rounded-2xl border border-blue-700">
            <p className="text-xs text-blue-200 uppercase font-bold">Reseñas Bloqueadas (Malas Palabras)</p>
            <p className="text-3xl font-black text-red-400 mt-1">{resenasBloqueadas.length}</p>
            <p className="text-xs text-blue-100 mt-1">Tolerancia cero: eliminadas</p>
          </div>
          <div className="bg-blue-900/70 p-4 rounded-2xl border border-blue-700">
            <p className="text-xs text-blue-200 uppercase font-bold">Último WhatsApp al Publicador</p>
            <p className="text-xs font-bold text-amber-200 mt-1.5 leading-snug line-clamp-2">
              {ultimoWhatsAppPublicador}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-blue-800 pt-3">
            <p className="text-xs text-blue-200">
              ⚡ <strong>Modo Autónomo Activo:</strong> El agente Gemini evalúa coherencia de título e imagen y resuelve directamente sin esperar a humanos.
            </p>
            <button
              type="button"
              onClick={ejecutarModeradorAutonomoEnTodas}
              className="bg-amber-400 hover:bg-amber-300 text-stone-950 font-black px-4 py-2 rounded-xl text-xs shadow transition"
            >
              ⚡ Ejecutar Moderador IA Autónomo en Pendientes
            </button>
          </div>
        </div>

        {/* Selector de pestañas */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-blue-800">
          <button
            type="button"
            onClick={() => setTabActiva("imagenes")}
            className={`px-5 py-2.5 rounded-xl font-black text-sm transition ${
              tabActiva === "imagenes"
                ? "bg-amber-400 text-stone-950 shadow"
                : "bg-blue-900 text-blue-100 hover:bg-blue-800"
            }`}
          >
            📸 Moderación de Imágenes y Eventos ({pendientes.length} pendientes)
          </button>
          <button
            type="button"
            onClick={() => setTabActiva("resenas")}
            className={`px-5 py-2.5 rounded-xl font-black text-sm transition ${
              tabActiva === "resenas"
                ? "bg-amber-400 text-stone-950 shadow"
                : "bg-blue-900 text-blue-100 hover:bg-blue-800"
            }`}
          >
            💬 Moderación de Reseñas (Filtro Palabras Malsonantes) ({resenasBloqueadas.length} bloqueadas)
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* PESTAÑA 1: MODERACIÓN DE IMÁGENES Y ACTIVIDADES                       */}
      {/* ===================================================================== */}
      {tabActiva === "imagenes" && (
        <div className="space-y-6">
          {/* 1. Pendientes */}
          <div className="caja-panel bg-white p-6 rounded-3xl shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black">⏳ 1. Imágenes y Eventos Pendientes (Cuentas Nivel 1)</h2>
                <p className="text-sm text-stone-600">
                  Gemini analiza el cartel con <code>gemini-2.5-flash</code>. Al aprobar o denegar, se notifica por
                  WhatsApp y el modelo aprende.
                </p>
              </div>
              <span className="bg-amber-400 text-stone-950 font-black px-3.5 py-1.5 rounded-full text-sm">
                {pendientes.length}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {pendientes.length === 0 ? (
                <div className="col-span-full bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center text-sm text-stone-600">
                  🎉 No hay actividades pendientes. Las cuentas con Fiabilidad 3 (como el Ayuntamiento) pasan con llamada
                  ligera <code>gemini-2.5-flash-lite</code> sin retención.
                </div>
              ) : (
                pendientes.map((act) => {
                  const evalRef = evaluarFiabilidadNegocio(act.negocio, cuentasNegocio);
                  const modImg = act.moderacionImagen || {
                    modelo: "gemini-2.5-flash",
                    esLlamadaLigera: false,
                    motivo: "Análisis visual completo de cartel."
                  };

                  return (
                    <article
                      key={act.id}
                      className="border-2 border-amber-400 bg-amber-50/40 rounded-2xl overflow-hidden flex flex-col justify-between"
                    >
                      <div>
                        <div className="relative">
                          <img src={act.imagen} alt={act.nombre} className="w-full h-44 object-cover" />
                          <span className="absolute top-2 right-2 bg-blue-950 text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
                            🤖 {modImg.modelo}
                          </span>
                        </div>
                        <div className="p-4 space-y-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="bg-amber-200 text-amber-950 text-xs font-black px-2.5 py-0.5 rounded-full">
                              ⏳ Nivel {evalRef.nivel}/3
                            </span>
                            <span className="bg-blue-100 text-blue-900 text-xs font-black px-2.5 py-0.5 rounded-full">
                              🏷️ {act.categoria}
                            </span>
                          </div>
                          <h3 className="font-black text-base text-stone-900">{act.nombre}</h3>
                          <p className="text-xs font-bold text-stone-600">
                            📍 {act.pueblo} · 🕒 {act.fecha}
                          </p>
                          <p className="text-xs text-stone-700">{act.descripcion}</p>

                          <div className="bg-white p-2.5 rounded-xl border border-amber-300 text-[11px] text-blue-950 space-y-1">
                            <p><strong>Llamada Fuerte Gemini (Categoría {act.categoria}):</strong></p>
                            <p>{modImg.motivo}</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 pt-0 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => aprobarActividad(act.id)}
                          className="bg-emerald-700 hover:bg-emerald-800 text-white font-black py-3 rounded-xl text-sm shadow"
                        >
                          ✅ Aprobar
                        </button>
                        <button
                          type="button"
                          onClick={() => denegarActividad(act.id)}
                          className="bg-red-600 hover:bg-red-700 text-white font-black py-3 rounded-xl text-sm shadow"
                        >
                          ❌ Denegar
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>

          {/* 2 y 3: Aprobadas vs Denegadas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Aprobadas */}
            <div className="caja-panel bg-white p-6 rounded-3xl shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-emerald-950">✅ 2. Actividades con Imágenes Validadas</h2>
                  <p className="text-xs text-stone-600">
                    Incluye llamadas ligeras <code>gemini-2.5-flash-lite</code> (Fiabilidad 3) y aprobadas por moderación.
                  </p>
                </div>
                <span className="bg-emerald-600 text-white font-black px-3.5 py-1.5 rounded-full text-sm">
                  {aprobadas.length}
                </span>
              </div>

              <div className="space-y-3 max-h-[450px] overflow-y-auto">
                {aprobadas.map((act) => {
                  const evalRef = evaluarFiabilidadNegocio(act.negocio, cuentasNegocio);
                  const esFiabilidad3 = evalRef.nivel === 3;
                  return (
                    <div
                      key={act.id}
                      className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-2xl flex items-center gap-3"
                    >
                      <img src={act.imagen} alt={act.nombre} className="w-16 h-16 object-cover rounded-xl shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                          <p className="font-black text-sm text-stone-900 truncate">{act.nombre}</p>
                          {esFiabilidad3 ? (
                            <span className="bg-amber-500 text-stone-950 text-[10px] font-black px-2 py-0.5 rounded-full">
                              ⚡ Llamada Ligera (Flash-Lite · Fiabilidad 3)
                            </span>
                          ) : (
                            <span className="bg-blue-950 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                              ✓ Validada Gemini Flash
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-600">
                          {act.pueblo} · {act.negocio}
                        </p>
                        <p className="text-[11px] font-bold text-emerald-800 mt-0.5">
                          {act.moderacionImagen?.motivo || act.motivoIA || "Validada correctamente"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Denegadas */}
            <div className="caja-panel bg-white p-6 rounded-3xl shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-red-950">❌ 3. Actividades Denegadas</h2>
                  <p className="text-xs text-stone-600">
                    Imágenes o carteles rechazados con aviso automático enviado por WhatsApp al publicador.
                  </p>
                </div>
                <span className="bg-red-600 text-white font-black px-3.5 py-1.5 rounded-full text-sm">
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
        </div>
      )}

      {/* ===================================================================== */}
      {/* PESTAÑA 2: MODERACIÓN DE RESEÑAS (DETECCIÓN DE PALABRAS MALSONANTES)  */}
      {/* ===================================================================== */}
      {tabActiva === "resenas" && (
        <div className="space-y-6">
          {/* Regla de Oro */}
          <div className="bg-red-50 border-2 border-red-300 p-4 rounded-3xl flex items-center gap-4">
            <span className="text-3xl">🚫</span>
            <div>
              <h3 className="font-black text-base text-red-950">
                Regla Estricta: Reseñas con palabras malsonantes se van directamente
              </h3>
              <p className="text-xs text-red-900 mt-0.5">
                A diferencia de las entidades de fiabilidad 3 que tienen llamada ligera en imágenes,{" "}
                <strong>en las reseñas no hay excepciones</strong>: cualquier opinión con insultos o palabras soeces es
                detectada por Gemini y bloqueada de inmediato sin llegar al público.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bloqueadas por palabras malsonantes */}
            <div className="caja-panel bg-white p-6 rounded-3xl shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-red-950">
                    🚫 Reseñas Bloqueadas / Eliminadas ({resenasBloqueadas.length})
                  </h2>
                  <p className="text-xs text-stone-600">
                    Detectadas por el modelo de lenguaje Gemini. Apartadas del negocio.
                  </p>
                </div>
                <span className="bg-red-600 text-white font-black px-3.5 py-1.5 rounded-full text-sm">
                  {resenasBloqueadas.length}
                </span>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {resenasBloqueadas.length === 0 ? (
                  <p className="text-stone-500 text-sm text-center py-6 bg-blue-50 rounded-2xl">
                    ✨ No hay reseñas con palabras malsonantes registradas.
                  </p>
                ) : (
                  resenasBloqueadas.map((r) => (
                    <div
                      key={r.id}
                      className="p-4 bg-red-50/70 border-2 border-red-300 rounded-2xl space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-sm text-stone-900">
                          {r.usuario} ➔ <span className="text-blue-900">{r.negocio}</span>
                        </span>
                        <span className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                          BLOQUEADA
                        </span>
                      </div>

                      <p className="text-sm text-stone-800 bg-white p-3 rounded-xl border border-red-200 font-medium">
                        "{r.texto}"
                      </p>

                      {r.palabrasDetectadas && r.palabrasDetectadas.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="font-bold text-red-900">Palabras detectadas:</span>
                          {r.palabrasDetectadas.map((p, i) => (
                            <span
                              key={i}
                              className="bg-red-200 text-red-950 font-black px-2 py-0.5 rounded-md"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      )}

                      <p className="text-[11px] font-bold text-red-800">{r.motivoIA}</p>

                      <div className="flex justify-end gap-2 pt-1 border-t border-red-200">
                        <button
                          type="button"
                          onClick={() => eliminarResena(r.id)}
                          className="bg-stone-300 hover:bg-stone-400 text-stone-900 text-xs font-bold px-3 py-1.5 rounded-xl"
                        >
                          🗑️ Purgar
                        </button>
                        <button
                          type="button"
                          onClick={() => restaurarResena(r.id)}
                          className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl"
                        >
                          ✓ Restaurar (Excepción manual)
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Aprobadas y Públicas */}
            <div className="caja-panel bg-white p-6 rounded-3xl shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-emerald-950">
                    ✅ Reseñas Aprobadas y Públicas ({resenasAprobadas.length})
                  </h2>
                  <p className="text-xs text-stone-600">
                    Opiniones limpias y respetuosas mostradas en las fichas de los negocios.
                  </p>
                </div>
                <span className="bg-emerald-600 text-white font-black px-3.5 py-1.5 rounded-full text-sm">
                  {resenasAprobadas.length}
                </span>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {resenasAprobadas.map((r) => (
                  <div
                    key={r.id}
                    className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm text-stone-900">
                        {r.usuario} ➔ <span className="text-blue-900">{r.negocio}</span>
                      </span>
                      <span className="text-amber-500 font-bold text-xs">{"⭐".repeat(r.estrellas || 5)}</span>
                    </div>
                    <p className="text-sm text-stone-800">"{r.texto}"</p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] font-bold text-emerald-800">
                        ✓ {r.motivoIA || "Aprobada por Gemini"}
                      </span>
                      <button
                        type="button"
                        onClick={() => eliminarResena(r.id)}
                        className="text-red-700 hover:text-red-900 text-xs font-bold"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
