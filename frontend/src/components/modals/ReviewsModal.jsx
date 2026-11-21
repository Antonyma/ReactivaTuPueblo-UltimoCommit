import React, { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { evaluarFiabilidadNegocio } from "../../data/mockData.js";

export default function ReviewsModal() {
  const { modalResenas, setModalResenas, cuentasNegocio, agregarResena } = useApp();
  const [estrellas, setEstrellas] = useState(5);
  const [texto, setTexto] = useState("");
  const [alertaRechazo, setAlertaRechazo] = useState("");

  const nombreNegocio = modalResenas.nombreNegocio;
  if (!modalResenas.open || !nombreNegocio) return null;

  const info = cuentasNegocio[nombreNegocio] || { resenas: [] };
  const evalRef = evaluarFiabilidadNegocio(nombreNegocio, cuentasNegocio);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!texto.trim()) return;
    setAlertaRechazo("");

    const res = await agregarResena(nombreNegocio, estrellas, texto.trim());
    if (res && res.exito === false) {
      setAlertaRechazo(
        `🚫 Reseña bloqueada por Gemini: se detectaron palabras malsonantes (${res.palabras.join(
          ", "
        )}). En PuebloVivo no se permiten insultos ni lenguaje ofensivo.`
      );
    } else {
      setTexto("");
      setAlertaRechazo("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white text-stone-900 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border-2 border-blue-700">
        <div className="flex justify-between items-center border-b pb-3">
          <div>
            <h3 className="font-black text-lg">Opiniones: {nombreNegocio}</h3>
            <p className="text-xs font-bold text-emerald-800">{evalRef.motivo}</p>
          </div>
          <button
            type="button"
            onClick={() => setModalResenas({ open: false, nombreNegocio: null })}
            className="w-10 h-10 rounded-full bg-blue-100 font-black text-xl hover:bg-blue-200"
          >
            ✕
          </button>
        </div>

        <div className="max-h-44 overflow-y-auto space-y-2 text-sm bg-blue-50 p-3 rounded-2xl border">
          {(!info.resenas || info.resenas.length === 0) ? (
            <p className="text-stone-500 text-center py-2">Sin opiniones todavía.</p>
          ) : (
            info.resenas.map((r, i) => (
              <div key={i} className="p-2.5 bg-white rounded-xl border border-blue-200">
                <p className="font-bold">
                  {r.usuario} <span className="text-amber-500">{"⭐".repeat(r.estrellas)}</span>
                </p>
                <p className="text-xs text-stone-700 mt-0.5">{r.texto}</p>
              </div>
            ))
          )}
        </div>

        {alertaRechazo && (
          <div className="bg-red-50 border-2 border-red-400 text-red-900 p-3 rounded-2xl text-xs font-bold space-y-1">
            <p className="font-black text-sm text-red-700">⚠️ Reseña no admitida</p>
            <p>{alertaRechazo}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <select
            value={estrellas}
            onChange={(e) => setEstrellas(Number(e.target.value))}
            className="w-full border-2 border-blue-300 rounded-xl p-2.5 font-bold bg-white"
          >
            <option value="5">⭐⭐⭐⭐⭐ Excelente (5)</option>
            <option value="4">⭐⭐⭐⭐ Muy bien (4)</option>
            <option value="3">⭐⭐⭐ Normal (3)</option>
            <option value="2">⭐⭐ Regular (2)</option>
            <option value="1">⭐ Mal (1)</option>
          </select>

          <input
            type="text"
            required
            placeholder="Escribe tu opinión aquí..."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="w-full border-2 border-blue-300 rounded-xl p-3"
          />

          <button
            type="submit"
            className="w-full bg-blue-700 hover:bg-blue-800 text-white font-black py-3 rounded-2xl shadow"
          >
            Enviar Opinión
          </button>
        </form>
      </div>
    </div>
  );
}
