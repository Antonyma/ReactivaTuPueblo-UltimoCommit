import React, { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext.jsx";

export default function LoginModal() {
  const { modalLogin, setModalLogin, loginUsuario, registerUsuario, usuario, logoutUsuario } = useApp();
  const [modo, setModo] = useState("login"); // 'login' | 'register'
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [tipoUsuario, setTipoUsuario] = useState(modalLogin.defaultTipo || "REGISTRADO");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (modalLogin.defaultTipo) {
      setTipoUsuario(modalLogin.defaultTipo);
    }
  }, [modalLogin.defaultTipo]);

  if (!modalLogin.open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      if (modo === "login") {
        await loginUsuario({ nombre, password });
      } else {
        await registerUsuario({ nombre, email, telefono, password, tipoUsuario });
      }
      setPassword("");
    } catch {
      // El toast de error ya se muestra en AppContext
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white text-stone-900 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border-2 border-blue-700">
        <div className="flex justify-between items-center border-b pb-3">
          <h3 className="font-black text-xl">
            {modo === "login" ? "Iniciar Sesión" : "Crear Cuenta"}
          </h3>
          <button
            type="button"
            onClick={() => setModalLogin({ open: false, defaultTipo: "REGISTRADO", motivo: "" })}
            className="w-10 h-10 rounded-full bg-blue-100 font-black text-xl hover:bg-blue-200"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 bg-blue-50 p-1 rounded-2xl border border-blue-200">
          <button
            type="button"
            onClick={() => setModo("login")}
            className={`py-2 rounded-xl text-sm font-black ${
              modo === "login" ? "bg-blue-700 text-white shadow" : "text-blue-950"
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => setModo("register")}
            className={`py-2 rounded-xl text-sm font-black ${
              modo === "register" ? "bg-blue-700 text-white shadow" : "text-blue-950"
            }`}
          >
            Registrarme
          </button>
        </div>

        <p className="text-sm text-blue-950 bg-blue-50 border border-blue-300 p-3 rounded-2xl">
          {modalLogin.motivo ||
            (modo === "login"
              ? "Introduce tu nombre y contraseña para acceder."
              : "Completa tus datos una sola vez para registrarte.")}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-bold mb-1">Nombre *</label>
            <input
              type="text"
              required
              placeholder="Ej: Antonio García"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full border-2 border-blue-300 rounded-xl p-3"
            />
          </div>

          {modo === "register" && (
            <>
              <div>
                <label className="block text-sm font-bold mb-1">Correo electrónico (Email) *</label>
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
                <label className="block text-sm font-bold mb-1">Teléfono WhatsApp *</label>
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
            </>
          )}

          <div>
            <label className="block text-sm font-bold mb-1">Contraseña *</label>
            <input
              type="password"
              required
              minLength={6}
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border-2 border-blue-300 rounded-xl p-3"
            />
          </div>

          {modo === "register" && (
            <div>
              <label className="block text-sm font-bold mb-1">¿Cómo te registras? *</label>
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
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-black py-3.5 rounded-2xl shadow"
          >
            {enviando
              ? "Conectando..."
              : modo === "login"
                ? "Entrar"
                : "Crear Cuenta y Entrar"}
          </button>
        </form>

        {usuario && (
          <button
            type="button"
            onClick={() => {
              logoutUsuario();
              setModalLogin({ open: false, defaultTipo: "REGISTRADO", motivo: "" });
            }}
            className="w-full bg-stone-200 hover:bg-stone-300 text-stone-900 font-bold py-2.5 rounded-2xl text-sm"
          >
            Cerrar sesión ({usuario.nombre})
          </button>
        )}
      </div>
    </div>
  );
}
