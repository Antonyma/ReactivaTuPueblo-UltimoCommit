import React, { useState, useRef, useEffect } from "react";
import { useApp } from "../context/useApp.js";
import { IconClose, IconMessage } from "./Icons.jsx";

const N8N_CHAT_WEBHOOK_URL = (import.meta.env?.VITE_N8N_CHAT_WEBHOOK_URL || "").trim();

const SUGERENCIAS_RAPIDAS = [
  "¿Qué planes próximos hay?",
  "Actividades gratis",
  "Planes en Lucainena de las Torres",
];

function crearSessionId() {
  return `web_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function extractReply(rawText) {
  if (!rawText) return "No se recibió respuesta del asistente.";
  try {
    const parsed = JSON.parse(rawText);
    const item = Array.isArray(parsed) ? parsed[0] : parsed;
    if (typeof item === "string") return item;
    if (item && typeof item === "object") {
      return (
        item.reply ||
        item.output ||
        item.response ||
        item.respuesta ||
        item.text ||
        item.message ||
        JSON.stringify(item)
      );
    }
    return String(parsed);
  } catch {
    return rawText;
  }
}

function renderInlineBold(line, keyPrefix) {
  const parts = String(line).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={`${keyPrefix}_b_${idx}`} className="font-black text-blue-950">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={`${keyPrefix}_t_${idx}`}>{part}</React.Fragment>;
  });
}

function FormattedMessage({ text, isUser }) {
  if (isUser) {
    return <span className="whitespace-pre-wrap">{text}</span>;
  }

  const lines = String(text || "").split("\n");
  return (
    <div className="space-y-1.5">
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line) return <div key={`sp_${idx}`} className="h-1" />;
        const isBullet = /^[-•*]\s+/.test(line);
        const content = isBullet ? line.replace(/^[-•*]\s+/, "") : line;
        if (isBullet) {
          return (
            <div key={`li_${idx}`} className="flex items-start gap-1.5 pl-1">
              <span className="text-blue-700 font-black mt-0.5 shrink-0">•</span>
              <span className="min-w-0">{renderInlineBold(content, `li_${idx}`)}</span>
            </div>
          );
        }
        return (
          <p key={`p_${idx}`} className="leading-snug">
            {renderInlineBold(content, `p_${idx}`)}
          </p>
        );
      })}
    </div>
  );
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
      .map(
        (a) =>
          `- **${a.nombre}** (${a.categoria}) — ${a.pueblo}, ${a.fecha} · ${a.dePago ? "De pago" : "Gratis"}`
      )
      .join("\n");
    return `He encontrado estas actividades relacionadas:\n${lista}`;
  }

  if (aprobadas.length > 0) {
    const pueblos = [...new Set(aprobadas.map((a) => a.pueblo).filter(Boolean))].slice(0, 4);
    return `Ahora mismo hay **${aprobadas.length} actividades** publicadas en la comarca (${pueblos.join(", ")}). Puedes preguntarme por un pueblo concreto, por planes gratis o por categoría.`;
  }

  return "Aún no hay actividades publicadas en este momento. Vuelve a comprobarlo pronto.";
}

const MENSAJE_BIENVENIDA = {
  id: "welcome",
  autor: "bot",
  texto:
    "¡Hola! Soy el **Guía de Pueblos**. Pregúntame por planes próximos, horarios, plazas libres o qué hacer en cualquier pueblo de la comarca.",
};

export default function EventsChatWidget() {
  const { usuario, isOnline, actividades } = useApp();
  const [abierto, setAbierto] = useState(false);
  const [input, setInput] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensajes, setMensajes] = useState([MENSAJE_BIENVENIDA]);

  const msgSeqRef = useRef(0);
  const nextMsgId = (prefix) => `${prefix}_${Date.now()}_${++msgSeqRef.current}`;
  const [sessionId, setSessionId] = useState(crearSessionId);
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

  const reiniciarChat = () => {
    setSessionId(crearSessionId());
    setMensajes([MENSAJE_BIENVENIDA]);
    setInput("");
  };

  const enviarTexto = async (rawTexto) => {
    const texto = String(rawTexto || "").trim();
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
          texto: `Sin conexión a internet.\n${respuestaLocalActividades(texto, actividades)}`,
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
        signal: AbortSignal.timeout(20000),
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

  const enviarPregunta = (e) => {
    e.preventDefault();
    enviarTexto(input);
  };

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-40 flex flex-col items-end gap-3">
      {abierto && (
        <div
          role="dialog"
          aria-label="Asistente de eventos"
          className="w-[calc(100vw-2rem)] sm:w-96 max-h-[75vh] bg-white rounded-3xl shadow-2xl border-2 border-blue-700 flex flex-col overflow-hidden"
        >
          <div className="bg-blue-950 text-white px-4 py-3 flex items-center justify-between gap-2 shrink-0">
            <div className="inline-flex items-center gap-2 min-w-0">
              <IconMessage className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <p className="font-black text-sm leading-tight truncate">Guía de Pueblos</p>
                <p className="text-[11px] text-blue-200 truncate">Asistente IA de actividades</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {mensajes.length > 1 && (
                <button
                  type="button"
                  onClick={reiniciarChat}
                  title="Nueva conversación"
                  className="btn-cerrar-modal px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold"
                >
                  Limpiar
                </button>
              )}
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar chat"
                className="btn-cerrar-modal w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center shrink-0"
              >
                <IconClose className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 bg-slate-50 text-sm">
            {mensajes.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.autor === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 leading-snug ${
                    m.autor === "user"
                      ? "bg-blue-700 text-white font-semibold"
                      : "bg-white text-stone-900 border border-slate-200 shadow-sm"
                  }`}
                >
                  <FormattedMessage text={m.texto} isUser={m.autor === "user"} />
                </div>
              </div>
            ))}

            {mensajes.length === 1 && !enviando && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGERENCIAS_RAPIDAS.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => enviarTexto(sug)}
                    className="btn-cerrar-modal text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 px-3 py-1.5 rounded-full transition"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            )}

            {enviando && (
              <div className="flex justify-start">
                <div className="bg-white text-blue-800 border border-blue-200 rounded-2xl px-3.5 py-2 text-xs font-bold animate-pulse">
                  Consultando eventos...
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
              placeholder="Ej: ¿Qué hay este finde?"
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
