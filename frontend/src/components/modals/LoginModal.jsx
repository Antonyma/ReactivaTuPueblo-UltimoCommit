import React, { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext.jsx";

export default function LoginModal() {
  const { modalLogin, setModalLogin, loginUsuario } = useApp();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [tipoUsuario, setTipoUsuario] = useState(modalLogin.defaultTipo || "REGISTRADO");

  useEffect(() => {
    if (modalLogin.defaultTipo) {
      setTipoUsuario(modalLogin.defaultTipo);
    }
  }, [modalLogin.defaultTipo]);

  if (!modalLogin.open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    loginUsuario({ nombre, email, telefono, tipoUsuario });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white text-stone-900 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border-2 border-blue-700">
        <div className="flex justify-between items-center border-b pb-3">
          <h3 className="font-black text-xl">Entrar / Registrarme</h3>
          <button
            type="button"
            onClick={() => setModalLogin({ open: false, defaultTipo: "REGISTRADO", motivo: "" })}
            className="w-10 h-10 rounded-full bg-blue-100 font-black text-xl hover:bg-blue-200"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-blue-950 bg-blue-50 border border-blue-300 p-3 rounded-2xl">
          {modalLogin.motivo || "Escribe tus datos una sola vez para apuntarte a planes o entrar con tu rol."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-bold mb-1">Tu nombre *</label>
            <input
              type="text"
              required
              placeholder="Ej: Antonio García"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full border-2 border-blue-300 rounded-xl p-3"
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-1">Tu correo electrónico (Email) *</label>
            <input
              type="email"
              required
              placeholder="antonio@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border-2 border-blue-300 rounded-xl p-3"
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-1">Tu teléfono WhatsApp *</label>
            <div className="flex items-center border-2 border-blue-300 rounded-xl overflow-hidden bg-white">
              <span className="bg-blue-50 text-blue-950 font-black px-3.5 py-3 border-r border-blue-300 select-none">
                🇪🇸 +34
              </span>
              <input
                type="tel"
                required
                placeholder="600 11 22 33"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="w-full p-3 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-1">¿Cómo entras hoy? *</label>
            <select
              value={tipoUsuario}
              onChange={(e) => setTipoUsuario(e.target.value)}
              className="w-full border-2 border-blue-300 rounded-xl p-3 font-bold bg-white"
            >
              <option value="REGISTRADO">🏡 Vecino / Turista (Apuntarme a planes)</option>
              <option value="PUBLICADOR">📢 Publicador (Negocio / Ayuntamiento)</option>
              <option value="MODERADOR">🛡️ Moderador (Revisión de actividades)</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-700 hover:bg-blue-800 text-white font-black py-3.5 rounded-2xl shadow"
          >
            Guardar y Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
