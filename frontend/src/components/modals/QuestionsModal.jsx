import React, { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { TELEFONO_BOT_WHATSAPP } from "../../data/mockData.js";

export default function QuestionsModal() {
  const { modalDudas, setModalDudas } = useApp();
  const [pregunta, setPregunta] = useState("");

  const act = modalDudas.actividad;
  if (!modalDudas.open || !act) return null;

  const mensajeWhatsApp = `Hola, tengo una duda sobre "${act.nombre}" (${act.pueblo}): ${pregunta.trim()}`;
  const whatsappUrl = `https://wa.me/${TELEFONO_BOT_WHATSAPP}?text=${encodeURIComponent(mensajeWhatsApp)}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white text-stone-900 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border-2 border-blue-700">
        <div className="flex justify-between items-center border-b pb-3">
          <h3 className="font-black text-lg">Preguntar por WhatsApp</h3>
          <button
            type="button"
            onClick={() => setModalDudas({ open: false, actividad: null })}
            className="w-10 h-10 rounded-full bg-blue-100 font-black text-xl hover:bg-blue-200"
          >
            ✕
          </button>
        </div>

        <p className="text-sm font-bold text-blue-900 bg-blue-50 p-2.5 rounded-xl border border-blue-200">
          📍 {act.nombre} ({act.pueblo})
        </p>
        <p className="text-sm text-stone-700">Escribe tu duda abajo y pulsa el botón verde para abrir WhatsApp:</p>

        <textarea
          rows={3}
          placeholder="Ej: ¿A qué hora empieza exactamente?"
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          className="w-full border-2 border-blue-300 rounded-2xl p-3"
        />

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
  );
}
