import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { IconClose } from "../Icons.jsx";

export default function LoginModal() {
  const { modalLogin, setModalLogin, loginUsuario, registerUsuario, usuario, logoutUsuario } =
    useApp();
  const [modo, setModo] = useState("login"); // 'login' | 'register'
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [tipoUsuario, setTipoUsuario] = useState(
    modalLogin.defaultTipo === "PUBLICADOR" ? "PUBLICADOR" : "REGISTRADO"
  );
  const [enviando, setEnviando] = useState(false);

  const cerrarModal = useCallback(() => {
    setModalLogin({ open: false, defaultTipo: "REGISTRADO", motivo: "" });
  }, [setModalLogin]);

  useEffect(() => {
    if (modalLogin.defaultTipo === "PUBLICADOR" || modalLogin.defaultTipo === "REGISTRADO") {
      setTipoUsuario(modalLogin.defaultTipo);
    } else {
      setTipoUsuario("REGISTRADO");
    }
  }, [modalLogin.defaultTipo]);

  useEffect(() => {
    if (!modalLogin.open) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") cerrarModal();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalLogin.open, cerrarModal]);

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
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3 sm:p-4"
      onClick={cerrarModal}
    >
      <div
        className="bg-white text-stone-900 rounded-3xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border-2 border-blue-700"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-login"
      >
        {/* Cabecera fija con botón X siempre visible */}
        <div className="shrink-0 flex justify-between items-center px-5 py-3.5 border-b border-blue-100 bg-white">
          <h3 id="titulo-modal-login" className="font-black text-lg sm:text-xl">
            {modo === "login" ? "Iniciar Sesión" : "Crear Cuenta"}
          </h3>
          <button
            type="button"
            onClick={cerrarModal}
            aria-label="Cerrar ventana"
            className="btn-cerrar-modal w-11 h-11 rounded-full bg-blue-100 text-blue-950 hover:bg-blue-200 flex items-center justify-center shrink-0"
          >
            <IconClose className="w-6 h-6" />
          </button>
        </div>

        {/* Contenido desplazable */}
        <div className="overflow-y-auto px-5 py-4 space-y-3">
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

          <p className="text-xs sm:text-sm text-blue-950 bg-blue-50 border border-blue-300 p-2.5 rounded-2xl">
            {modalLogin.motivo ||
              (modo === "login"
                ? "Introduce tu nombre y contraseña para acceder."
                : "Completa tus datos una sola vez para registrarte.")}
          </p>

          <form onSubmit={handleSubmit} className="space-y-2.5">
            <div>
              <label className="block text-sm font-bold mb-1">Nombre *</label>
              <input
                type="text"
                required
                placeholder="Ej: Antonio García"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full border-2 border-blue-300 rounded-xl p-2.5 text-base"
              />
            </div>

            {modo === "register" && (
              <>
                <div>
                  <label className="block text-sm font-bold mb-1">Correo electrónico *</label>
                  <input
                    type="email"
                    required
                    placeholder="antonio@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border-2 border-blue-300 rounded-xl p-2.5 text-base"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-1">Teléfono WhatsApp *</label>
                  <div className="flex items-center border-2 border-blue-300 rounded-xl overflow-hidden bg-white">
                    <span className="bg-blue-50 text-blue-950 font-black px-3 py-2.5 border-r border-blue-300 select-none text-sm sm:text-base">
                      +34
                    </span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]+"
                      required
                      placeholder="600112233"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value.replace(/\D/g, ""))}
                      className="w-full p-2.5 outline-none text-base"
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
                className="w-full border-2 border-blue-300 rounded-xl p-2.5 text-base"
              />
            </div>

            {modo === "register" && (
              <div>
                <label className="block text-sm font-bold mb-1">¿Cómo te registras? *</label>
                <select
                  value={tipoUsuario}
                  onChange={(e) => setTipoUsuario(e.target.value)}
                  className="w-full border-2 border-blue-300 rounded-xl p-2.5 font-bold bg-white text-base"
                >
                  <option value="REGISTRADO">Usuario (Apuntarme a planes)</option>
                  <option value="PUBLICADOR">Publicador (Negocio / Ayuntamiento)</option>
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={enviando}
              className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-black py-3 rounded-2xl shadow mt-1"
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
                cerrarModal();
              }}
              className="w-full bg-stone-200 hover:bg-stone-300 text-stone-900 font-bold py-2.5 rounded-2xl text-sm"
            >
              Cerrar sesión ({usuario.nombre})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
