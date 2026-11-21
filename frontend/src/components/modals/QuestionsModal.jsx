import React, { useState, useCallback } from "react";
import { useApp } from "../../context/useApp.js";
import { eventosApi, getAuthToken } from "../../api/client.js";
import { TELEFONO_BOT_WHATSAPP } from "../../constants/comarca.js";
import { IconMapPin, IconMessage } from "../Icons.jsx";
import BaseModal from "./BaseModal.jsx";

export default function QuestionsModal() {
  const { modalDudas, setModalDudas, isOnline } = useApp();
  const [pregunta, setPregunta] = useState("");
  const [respuestaIA, setRespuestaIA] = useState("");
  const [consultando, setConsultando] = useState(false);

  const act = modalDudas.actividad;

  const cerrarModal = useCallback(() => {
    setRespuestaIA("");
    setModalDudas({ open: false, actividad: null });
  }, [setModalDudas]);

  const mensajeWhatsApp = act
    ? `Hola, tengo una duda sobre "${act.nombre}" (${act.pueblo}): ${pregunta.trim()}`
    : "";
  const whatsappUrl = `https://wa.me/${TELEFONO_BOT_WHATSAPP}?text=${encodeURIComponent(mensajeWhatsApp)}`;

  const handlePreguntarIA = async () => {
    if (!act || !pregunta.trim()) return;
    if (!isOnline) {
      setRespuestaIA(
        "Estás sin conexión a internet. Puedes consultar el lugar, fecha y descripción guardados en la ficha del evento y volver a preguntar al asistente en cuanto recuperes cobertura."
      );
      return;
    }
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
    <BaseModal
      open={Boolean(modalDudas.open && act)}
      onClose={cerrarModal}
      title="Resolver Dudas"
      maxWidthClass="max-w-md"
      containerClassName="bg-white text-stone-900 rounded-3xl w-full max-h-[90vh] overflow-y-auto p-5 shadow-2xl border-2 border-blue-700 space-y-3"
    >
      {act && (
        <>
          <p className="text-sm font-bold text-blue-900 bg-blue-50 p-2.5 rounded-xl border border-blue-200 flex items-center gap-2">
            <IconMapPin className="w-4 h-4 shrink-0" />
            <span>
              {act.nombre} ({act.pueblo})
            </span>
          </p>
          <label htmlFor="modal-dudas-texto" className="block text-sm text-stone-700">
            Escribe tu duda abajo:
          </label>

          <textarea
            id="modal-dudas-texto"
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
        </>
      )}
    </BaseModal>
  );
}
