import React, { useState, useRef, useEffect } from "react";
import { useApp } from "../context/useApp.js";
import { getAuthToken } from "../api/client.js";
import { IconClose, IconMessage } from "./Icons.jsx";
import { esEventoFinalizado, getEventTimestamp } from "../utils/eventUtils.js";

const N8N_CHAT_WEBHOOK_URL = (import.meta.env?.VITE_N8N_CHAT_WEBHOOK_URL || "").trim();

const FAQS_STORAGE_KEY = "pueblovivo_chat_faqs_v1";

const FAQS_INICIALES = [
  { texto: "¿Qué planes próximos hay?", count: 12 },
  { texto: "¿Qué actividades gratis hay este fin de semana?", count: 9 },
  { texto: "¿Cómo me apunto a un evento o taller?", count: 7 },
  { texto: "¿Qué pueblos tienen eventos publicados?", count: 5 },
  { texto: "¿Cómo publico mi comercio o actividad?", count: 4 },
];

function cargarFaqs() {
  try {
    const raw = window.localStorage.getItem(FAQS_STORAGE_KEY);
    if (!raw) return FAQS_INICIALES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return FAQS_INICIALES;
    return parsed.filter((f) => f && typeof f.texto === "string" && typeof f.count === "number");
  } catch {
    return FAQS_INICIALES;
  }
}

function registrarPreguntaFaq(listaActual, textoPregunta) {
  const limpia = String(textoPregunta || "").trim();
  if (limpia.length < 6) return listaActual;
  const clave = normalizarTexto(limpia);
  const idx = listaActual.findIndex((f) => normalizarTexto(f.texto) === clave);
  const siguiente =
    idx >= 0
      ? listaActual.map((f, i) => (i === idx ? { ...f, count: f.count + 1 } : f))
      : [...listaActual, { texto: limpia, count: 1 }];
  try {
    window.localStorage.setItem(FAQS_STORAGE_KEY, JSON.stringify(siguiente));
  } catch {
    // Ignorar errores de almacenamiento (modo privado / cuota)
  }
  return siguiente;
}

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
        const isSubBullet = /^\s{2,}[-•*]\s+/.test(rawLine);
        const isBullet = /^[-•*]\s+/.test(line);
        const content = isBullet ? line.replace(/^[-•*]\s+/, "") : line;
        if (isBullet) {
          return (
            <div
              key={`li_${idx}`}
              className={`flex items-start gap-1.5 ${isSubBullet ? "pl-4 text-xs text-stone-700" : "pl-1"}`}
            >
              <span className={`${isSubBullet ? "text-blue-400" : "text-blue-700"} font-black mt-0.5 shrink-0`}>
                {isSubBullet ? "◦" : "•"}
              </span>
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

function normalizarTexto(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formatearEventoLocal(a) {
  const precio = a.dePago ? "De pago" : "Gratis";
  const plazas =
    a.aforo > 0
      ? ` · ${Math.max(0, a.aforo - (a.asistentesActuales ?? a.asistentes ?? 0))} plazas libres`
      : "";
  return `- **${a.nombre}** (${a.categoria || "Actividad"}) — ${a.pueblo}, ${a.fecha} · ${precio}${plazas}`;
}

function respuestaLocalActividades(pregunta, actividades) {
  const q = normalizarTexto(pregunta).trim();
  const ahoraMs = Date.now();
  const aprobadas = (actividades || []).filter((a) => a.estadoModeracion === "aprobada");

  if (aprobadas.length === 0) {
    return "Aún no hay actividades publicadas en este momento. Vuelve a comprobarlo pronto.";
  }

  const ordenarPorFecha = (lista) =>
    [...lista].sort((a, b) => {
      const ta = getEventTimestamp(a.fechaInicioMs, a.fechaInicioISO) || Number.MAX_SAFE_INTEGER;
      const tb = getEventTimestamp(b.fechaInicioMs, b.fechaInicioISO) || Number.MAX_SAFE_INTEGER;
      return ta - tb;
    });

  const proximas = ordenarPorFecha(aprobadas.filter((a) => !esEventoFinalizado(a, ahoraMs)));
  const base = proximas.length > 0 ? proximas : ordenarPorFecha(aprobadas);

  if (/^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|saludos)\b/.test(q)) {
    const pueblos = [...new Set(base.map((a) => a.pueblo).filter(Boolean))].slice(0, 4);
    return `¡Hola! Ahora mismo tengo **${proximas.length} próximos planes** en la Mancomunidad de Pueblos del Interior de Almería (${pueblos.join(", ")}). Pregúntame por próximos eventos, planes gratis o un pueblo concreto y te los enseño.`;
  }

  let filtradas = base;
  const etiquetas = [];

  if (/\b(gratis|gratuit\w*|sin coste|libre)\b/.test(q)) {
    filtradas = filtradas.filter((a) => !a.dePago);
    etiquetas.push("gratis");
  } else if (/\b(de pago|pagando|entrada)\b/.test(q)) {
    filtradas = filtradas.filter((a) => a.dePago);
    etiquetas.push("de pago");
  }

  const pueblosDisponibles = [...new Set(aprobadas.map((a) => a.pueblo).filter(Boolean))];
  const puebloMencionado = pueblosDisponibles.find((p) => q.includes(normalizarTexto(p)));
  if (puebloMencionado) {
    filtradas = filtradas.filter((a) => a.pueblo === puebloMencionado);
    etiquetas.push(`en ${puebloMencionado}`);
  }

  const categoriasDisponibles = [...new Set(aprobadas.map((a) => a.categoria).filter(Boolean))];
  const categoriaMencionada = categoriasDisponibles.find((c) => q.includes(normalizarTexto(c)));
  if (categoriaMencionada) {
    filtradas = filtradas.filter((a) => a.categoria === categoriaMencionada);
    etiquetas.push(`de ${categoriaMencionada}`);
  }

  const esConsultaGeneral =
    /\b(proxim\w*|por venir|siguiente\w*|que hay|que planes|que hacer|hoy|manana|finde|fin de semana|semana|actividad\w*|evento\w*|plan\w*)\b/.test(
      q
    );

  if (etiquetas.length > 0) {
    if (filtradas.length > 0) {
      const lista = filtradas.slice(0, 4).map(formatearEventoLocal).join("\n");
      return `Aquí tienes los planes ${etiquetas.join(" ")}:\n${lista}`;
    }
    return `No he encontrado actividades ${etiquetas.join(" ")} ahora mismo. Si quieres, te enseño los próximos planes en el resto de la mancomunidad.`;
  }

  const stopwords = new Set([
    "que",
    "hay",
    "para",
    "por",
    "con",
    "los",
    "las",
    "unos",
    "unas",
    "este",
    "esta",
    "como",
    "donde",
    "cuando",
    "hacer",
    "planes",
    "plan",
    "venir",
    "proximos",
    "proximas",
    "actividades",
    "eventos",
  ]);
  const tokens = q.split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !stopwords.has(w));
  if (tokens.length > 0) {
    const coincidencias = base.filter((a) => {
      const hay = normalizarTexto(`${a.nombre} ${a.pueblo} ${a.categoria} ${a.descripcion}`);
      return tokens.some((tok) => hay.includes(tok));
    });
    if (coincidencias.length > 0) {
      const lista = coincidencias.slice(0, 4).map(formatearEventoLocal).join("\n");
      return `He encontrado estas actividades relacionadas:\n${lista}`;
    }
  }

  if (esConsultaGeneral || proximas.length > 0) {
    const lista = base.slice(0, 4).map(formatearEventoLocal).join("\n");
    const encabezado =
      proximas.length > 0
        ? `Estos son los próximos planes disponibles (${proximas.length} en total):`
        : "Ahora mismo no hay eventos futuros programados, pero estas son las actividades publicadas:";
    return `${encabezado}\n${lista}\nPuedes pedirme que filtre por pueblo, categoría o planes gratis.`;
  }

  const pueblos = pueblosDisponibles.slice(0, 4);
  return `Ahora mismo hay **${aprobadas.length} actividades** publicadas en la Mancomunidad de Pueblos del Interior de Almería (${pueblos.join(", ")}). Puedes preguntarme por un pueblo concreto, por planes gratis o por categoría.`;
}

const MENSAJE_BIENVENIDA = {
  id: "welcome",
  autor: "bot",
  texto:
    "¡Hola! Soy el **Guía de Pueblos**. Pregúntame por planes próximos, horarios, plazas libres o qué hacer en cualquier pueblo de la Mancomunidad de Pueblos del Interior de Almería.",
};

export default function EventsChatWidget() {
  const { usuario, isOnline, actividades, recargarDatos } = useApp();
  const [abierto, setAbierto] = useState(false);
  const [input, setInput] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensajes, setMensajes] = useState([MENSAJE_BIENVENIDA]);
  const [faqs, setFaqs] = useState(cargarFaqs);

  const topFaqs = [...faqs].sort((a, b) => b.count - a.count).slice(0, 3);

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
    const onToggleChat = () => setAbierto((prev) => !prev);
    window.addEventListener("pueblovivo:toggle-chat", onToggleChat);
    return () => window.removeEventListener("pueblovivo:toggle-chat", onToggleChat);
  }, []);

  useEffect(() => {
    if (!abierto) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setAbierto(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [abierto]);

  if (usuario?.tipoUsuario === "MODERADOR") {
    return null;
  }

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
    setFaqs((prev) => registrarPreguntaFaq(prev, texto));
    setInput("");

    if (!isOnline) {
      setMensajes((prev) => [
        ...prev,
        {
          id: nextMsgId("b"),
          autor: "bot",
          esFallback: true,
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
          esFallback: true,
          texto: respuestaLocalActividades(texto, actividades),
        },
      ]);
      return;
    }

    setEnviando(true);
    try {
      const authToken = getAuthToken() || "";
      const res = await fetch(N8N_CHAT_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          message: texto,
          chatInput: texto,
          pregunta: texto,
          sessionId: usuario?.id ? `user_${usuario.id}` : sessionId,
          usuarioId: usuario?.id ?? null,
          usuarioNombre: usuario?.nombre || "Visitante",
          usuarioRol: usuario?.tipoUsuario || "VISITANTE",
          authToken,
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

      if (
        /\b(inscrit[oa]|apuntad[oa]|desapuntad[oa]|valoraci[oó]n.*guardad|cread[oa]|publicad[oa]|actualizad[oa]|eliminad[oa]|borrad[oa]|finalizad[oa]|terminad[oa]|solicitud.*enviad)\b/i.test(
          respuesta
        )
      ) {
        recargarDatos?.();
      }
    } catch (err) {
      console.warn("[EventsChatWidget] Fallback local por error en webhook:", err?.message || err);
      setMensajes((prev) => [
        ...prev,
        {
          id: nextMsgId("b"),
          autor: "bot",
          esFallback: true,
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
    <div
      className={
        abierto
          ? "fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 z-50 flex flex-col sm:items-end sm:gap-3"
          : "fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 flex flex-col items-end gap-3"
      }
    >
      {abierto && (
        <div
          role="dialog"
          aria-label="Asistente de eventos"
          className="w-full h-full sm:w-96 sm:h-auto sm:max-h-[75vh] bg-white sm:rounded shadow-2xl sm:border sm:border-[#16324F] flex flex-col overflow-hidden"
        >
          <div className="bg-[#16324F] text-white px-4 py-3 flex items-center justify-between gap-2 shrink-0">
            <div className="inline-flex items-center gap-2 min-w-0">
              <IconMessage className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <p className="font-black text-sm leading-tight truncate">Guía de Pueblos</p>
                <p className="text-[11px] text-amber-200 truncate">Asistente IA de actividades</p>
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
                      ? "bg-[#3D5A3C] text-white font-semibold"
                      : "bg-white text-stone-900 border border-[#DFD5C5] shadow-sm"
                  }`}
                >
                  <FormattedMessage text={m.texto} isUser={m.autor === "user"} />
                  {m.esFallback && (
                    <p className="mt-1.5 text-[10px] text-slate-400 font-medium">
                      Respuesta local (asistente IA temporalmente no disponible)
                    </p>
                  )}
                </div>
              </div>
            ))}

            {mensajes.length === 1 && !enviando && topFaqs.length > 0 && (
              <div className="bg-white border border-blue-200 rounded-2xl shadow-sm overflow-hidden mt-1">
                <div className="px-3.5 py-2 bg-blue-50/80 border-b border-blue-100 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-blue-950">
                    Preguntas frecuentes (FAQs)
                  </span>
                  <span className="text-[10px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full shrink-0">
                    Top 3 más hechas
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {topFaqs.map((faq, idx) => (
                    <button
                      key={faq.texto}
                      type="button"
                      onClick={() => enviarTexto(faq.texto)}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-blue-50/60 transition flex items-start justify-between gap-2.5 group"
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-[#16324F] text-white text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-bold text-stone-800 group-hover:text-blue-950 leading-snug">
                          {faq.texto}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-blue-700 shrink-0 mt-0.5">
                        {faq.count}×
                      </span>
                    </button>
                  ))}
                </div>
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
              className="bg-[#C85A17] hover:bg-[#AD4B10] disabled:opacity-50 text-white font-bold px-4 py-2 rounded text-sm shrink-0"
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
        className={`${
          abierto ? "hidden sm:inline-flex" : "inline-flex"
        } items-center gap-2 bg-[#16324F] hover:bg-[#1E4268] text-white font-bold px-4 py-3 rounded shadow-lg border border-amber-400 transition`}
      >
        <IconMessage className="w-5 h-5 shrink-0" />
        <span className="text-sm">{abierto ? "Cerrar" : "Preguntar"}</span>
      </button>
    </div>
  );
}
