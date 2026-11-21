import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { eventosApi, getAuthToken } from "../../api/client.js";
import { TELEFONO_BOT_WHATSAPP } from "../../constants/comarca.js";
import { IconClose, IconMapPin, IconMessage } from "../Icons.jsx";

export default function QuestionsModal() {
  const { modalDudas, setModalDudas } = useApp();
  const [pregunta, setPregunta] = useState("");
  const [respuestaIA, setRespuestaIA] = useState("");
  const [consultando, setConsultando] = useState(false);

  const act = modalDudas.actividad;

  const cerrarModal = useCallback(() => {
    setRespuestaIA("");
    setModalDudas({ open: false, actividad: null });
  }, [setModalDudas]);

  useEffect(() => {
    if (!modalDudas.open) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") cerrarModal();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalDudas.open, cerrarModal]);

  if (!modalDudas.open || !act) return null;

  const mensajeWhatsApp = `Hola, tengo una duda sobre "${act.nombre}" (${act.pueblo}): ${pregunta.trim()}`;
  const whatsappUrl = `https://wa.me/${TELEFONO_BOT_WHATSAPP}?text=${encodeURIComponent(mensajeWhatsApp)}`;

  const handlePreguntarIA = async () => {
    if (!pregunta.trim()) return;
    setConsultando(true);
    try {
      const res = await eventosApi.resolverDuda(act.id, pregunta.trim());
      setRespuestaIA(res?.data?.respuesta || "Sin respuesta disponible.");
    } catch (err) {
      setRespuestaIA(`No se pudo consultar al asistente: ${err.message}`);
    } finally {
      setConsultando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3 sm:p-4"
      onClick={cerrarModal}
    >
      <div
        className="bg-white text-stone-900 rounded-3xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border-2 border-blue-700"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="shrink-0 flex justify-between items-center px-5 py-3.5 border-b border-blue-100 bg-white">
          <h3 className="font-black text-lg sm:text-xl">Resolver Dudas</h3>
          <button
            type="button"
            onClick={cerrarModal}
            aria-label="Cerrar ventana"
            className="btn-cerrar-modal w-11 h-11 rounded-full bg-blue-100 text-blue-950 hover:bg-blue-200 flex items-center justify-center shrink-0"
          >
            <IconClose className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-3">
          <p className="text-sm font-bold text-blue-900 bg-blue-50 p-2.5 rounded-xl border border-blue-200 flex items-center gap-2">
            <IconMapPin className="w-4 h-4 shrink-0" />
            <span>
              {act.nombre} ({act.pueblo})
            </span>
          </p>
          <p className="text-sm text-stone-700">Escribe tu duda abajo:</p>

          <textarea
            rows={3}
            placeholder="Ej: ¿A qué hora empieza exactamente?"
            value={pregunta}
            onChange={(e) => setPregunta(e.target.value)}
            className="w-full border-2 border-blue-300 rounded-2xl p-3 text-base"
          />

          {respuestaIA && (
            <div className="text-sm bg-blue-50 border border-blue-200 rounded-2xl p-3 text-blue-950">
              <strong>Asistente:</strong> {respuestaIA}
            </div>
          )}

          <div className="space-y-2">
            {getAuthToken() && (
              <button
                type="button"
                disabled={consultando || !pregunta.trim()}
                onClick={handlePreguntarIA}
                className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-black py-3 px-4 rounded-2xl shadow"
              >
                {consultando ? "Consultando..." : "Preguntar al Asistente"}
              </button>
            )}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 shadow"
            >
              <IconMessage className="w-5 h-5" />
              <span>Abrir WhatsApp y Enviar</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
