import React, { useState, useRef, useEffect } from "react";
import { useApp } from "../context/useApp.js";
import { IconClose, IconMessage } from "./Icons.jsx";

const N8N_CHAT_WEBHOOK_URL = (import.meta.env?.VITE_N8N_CHAT_WEBHOOK_URL || "").trim();

function extractReply(rawText) {
  if (!rawText) return "No se recibió respuesta del asistente.";
  try {
    const parsed = JSON.parse(rawText);
    const item = Array.isArray(parsed) ? parsed[0] : parsed;
    if (typeof item === "string") return item;
    if (item && typeof item === "object") {
      return (
        item.output ||
        item.response ||
        item.respuesta ||
        item.text ||
        item.message ||
        item.reply ||
        JSON.stringify(item)
      );
    }
    return String(parsed);
  } catch {
    return rawText;
  }
}

function respuestaLocalActividades(pregunta, actividades) {
  const q = pregunta.toLowerCase();
  const aprobadas = (actividades || []).filter((a) => a.estadoModeracion === "aprobada");
  const coincidencias = aprobadas.filter((a) => {
    const hay = `${a.nombre} ${a.pueblo} ${a.categoria} ${a.descripcion}`.toLowerCase();
    return q.split(/\s+/).some((pal) => pal.length > 3 && hay.includes(pal));
  });

  if (coincidencias.length > 0) {
    const lista = coincidencias
      .slice(0, 3)
      .map((a) => `• ${a.nombre} (${a.pueblo}, ${a.fecha}) — ${a.dePago ? "De pago" : "Gratis"}`)
      .join("\n");
    return `He encontrado estas actividades relacionadas:\n${lista}`;
  }

  if (aprobadas.length > 0) {
    const pueblos = [...new Set(aprobadas.map((a) => a.pueblo).filter(Boolean))].slice(0, 4);
    return `Ahora mismo hay ${aprobadas.length} actividades activas en la comarca (${pueblos.join(", ")}). Puedes usar el buscador o los filtros por pueblo y categoría para explorarlas.`;
  }

  return "Aún no hay actividades publicadas en este momento. Vuelve a comprobarlo pronto.";
}

export default function EventsChatWidget() {
  const { usuario, isOnline, actividades } = useApp();
  const [abierto, setAbierto] = useState(false);
  const [input, setInput] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensajes, setMensajes] = useState([
    {
      id: "welcome",
      autor: "bot",
      texto: "¡Hola! Pregúntame lo que quieras sobre los eventos y actividades de los pueblos.",
    },
  ]);

  const msgSeqRef = useRef(0);
  const nextMsgId = (prefix) => `${prefix}_${Date.now()}_${++msgSeqRef.current}`;
  const [sessionId] = useState(
    () => `web_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  );
  const bottomRef = useRef(null);

  useEffect(() => {
    if (abierto) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [mensajes, abierto]);

  useEffect(() => {
    if (!abierto) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setAbierto(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [abierto]);

  const enviarPregunta = async (e) => {
    e.preventDefault();
    const texto = input.trim();
    if (!texto || enviando) return;

    const userMsg = { id: nextMsgId("u"), autor: "user", texto };
    setMensajes((prev) => [...prev, userMsg]);
    setInput("");

    if (!isOnline) {
      setMensajes((prev) => [
        ...prev,
        {
          id: nextMsgId("b"),
          autor: "bot",
          texto: `Sin conexión a internet. ${respuestaLocalActividades(texto, actividades)}`,
        },
      ]);
      return;
    }

    if (!N8N_CHAT_WEBHOOK_URL) {
      setMensajes((prev) => [
        ...prev,
        {
          id: nextMsgId("b"),
          autor: "bot",
          texto: respuestaLocalActividades(texto, actividades),
        },
      ]);
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch(N8N_CHAT_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          message: texto,
          chatInput: texto,
          pregunta: texto,
          sessionId: usuario?.id ? `user_${usuario.id}` : sessionId,
          usuarioId: usuario?.id ?? null,
          usuarioNombre: usuario?.nombre || "Visitante",
        }),
      });

      const rawText = await res.text();
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const respuesta = extractReply(rawText);
      setMensajes((prev) => [
        ...prev,
        { id: nextMsgId("b"), autor: "bot", texto: respuesta },
      ]);
    } catch {
      setMensajes((prev) => [
        ...prev,
        {
          id: nextMsgId("b"),
          autor: "bot",
          texto: respuestaLocalActividades(texto, actividades),
        },
      ]);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-40 flex flex-col items-end gap-3">
      {abierto && (
        <div
          role="dialog"
          aria-label="Asistente de eventos"
          className="w-[calc(100vw-2rem)] sm:w-96 max-h-[70vh] bg-white rounded-3xl shadow-2xl border-2 border-blue-700 flex flex-col overflow-hidden"
        >
          <div className="bg-blue-950 text-white px-4 py-3 flex items-center justify-between gap-2 shrink-0">
            <div className="inline-flex items-center gap-2 min-w-0">
              <IconMessage className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <p className="font-black text-sm leading-tight truncate">Asistente de Eventos</p>
                <p className="text-[11px] text-blue-200 truncate">Pregúntame sobre planes y pueblos</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar chat"
              className="btn-cerrar-modal w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center shrink-0"
            >
              <IconClose className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 bg-slate-50 text-sm">
            {mensajes.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.autor === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 whitespace-pre-wrap leading-snug ${
                    m.autor === "user"
                      ? "bg-blue-700 text-white font-semibold"
                      : "bg-white text-stone-900 border border-slate-200 shadow-sm"
                  }`}
                >
                  {m.texto}
                </div>
              </div>
            ))}
            {enviando && (
              <div className="flex justify-start">
                <div className="bg-white text-stone-500 border border-slate-200 rounded-2xl px-3.5 py-2 text-xs font-bold">
                  Pensando...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={enviarPregunta}
            className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
          >
            <label htmlFor="chat-widget-input" className="sr-only">
              Escribe tu pregunta
            </label>
            <input
              id="chat-widget-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu pregunta..."
              disabled={enviando}
              className="flex-1 border-2 border-blue-200 focus:border-blue-600 outline-none rounded-xl px-3 py-2 text-sm text-stone-900 bg-white"
            />
            <button
              type="submit"
              disabled={enviando || !input.trim()}
              className="bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-black px-4 py-2 rounded-xl text-sm shrink-0"
            >
              Enviar
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setAbierto((prev) => !prev)}
        aria-expanded={abierto}
        aria-label={abierto ? "Cerrar asistente de eventos" : "Abrir asistente de eventos"}
        className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-black px-4 py-3.5 rounded-full shadow-lg border-2 border-white transition"
      >
        <IconMessage className="w-5 h-5 shrink-0" />
        <span className="text-sm">{abierto ? "Cerrar" : "Preguntar"}</span>
      </button>
    </div>
  );
}
