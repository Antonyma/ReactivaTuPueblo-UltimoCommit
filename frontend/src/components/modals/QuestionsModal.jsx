import React, { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { eventosApi, getAuthToken } from "../../api/client.js";
import { TELEFONO_BOT_WHATSAPP } from "../../constants/comarca.js";

export default function QuestionsModal() {
  const { modalDudas, setModalDudas } = useApp();
  const [pregunta, setPregunta] = useState("");
  const [respuestaIA, setRespuestaIA] = useState("");
  const [consultando, setConsultando] = useState(false);

  const act = modalDudas.actividad;
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
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white text-stone-900 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border-2 border-blue-700">
        <div className="flex justify-between items-center border-b pb-3">
          <h3 className="font-black text-lg">Resolver Dudas</h3>
          <button
            type="button"
            onClick={() => {
              setRespuestaIA("");
              setModalDudas({ open: false, actividad: null });
            }}
            className="w-10 h-10 rounded-full bg-blue-100 font-black text-xl hover:bg-blue-200"
          >
            ✕
          </button>
        </div>

        <p className="text-sm font-bold text-blue-900 bg-blue-50 p-2.5 rounded-xl border border-blue-200">
          📍 {act.nombre} ({act.pueblo})
        </p>
        <p className="text-sm text-stone-700">Escribe tu duda abajo:</p>

        <textarea
          rows={3}
          placeholder="Ej: ¿A qué hora empieza exactamente?"
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          className="w-full border-2 border-blue-300 rounded-2xl p-3"
        />

        {respuestaIA && (
          <div className="text-sm bg-blue-50 border border-blue-200 rounded-2xl p-3 text-blue-950">
            <strong>🤖 Asistente:</strong> {respuestaIA}
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
              {consultando ? "Consultando..." : "🤖 Preguntar al Asistente"}
            </button>
          )}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 px-4 rounded-2xl text-center block shadow"
          >
            💬 Abrir WhatsApp y Enviar
          </a>
        </div>
      </div>
    </div>
  );
}
