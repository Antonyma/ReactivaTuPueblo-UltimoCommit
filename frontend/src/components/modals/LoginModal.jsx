import React, { useState, useCallback } from "react";
import { useApp } from "../../context/useApp.js";
import BaseModal from "./BaseModal.jsx";

function LoginFormContent({ defaultTipo, motivo, usuario, onLogin, onRegister, onLogout, onClose }) {
  const [modo, setModo] = useState("login");
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [tipoUsuario, setTipoUsuario] = useState(
    defaultTipo === "PUBLICADOR" ? "PUBLICADOR" : "REGISTRADO"
  );
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      if (modo === "login") {
        await onLogin({ nombre, password });
      } else {
        await onRegister({ nombre, email, telefono, password, tipoUsuario });
      }
      setPassword("");
    } catch {
      // El toast de error ya se muestra en AppContext
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-3">
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
        {motivo ||
          (modo === "login"
            ? "Introduce tu nombre y contraseña para acceder."
            : "Completa tus datos una sola vez para registrarte.")}
      </p>

      <form onSubmit={handleSubmit} className="space-y-2.5">
        <div>
          <label htmlFor="login-nombre" className="block text-sm font-bold mb-1">
            Nombre *
          </label>
          <input
            id="login-nombre"
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
              <label htmlFor="login-email" className="block text-sm font-bold mb-1">
                Correo electrónico *
              </label>
              <input
                id="login-email"
                type="email"
                required
                placeholder="antonio@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border-2 border-blue-300 rounded-xl p-2.5 text-base"
              />
            </div>

            <div>
              <label htmlFor="login-telefono" className="block text-sm font-bold mb-1">
                Teléfono WhatsApp *
              </label>
              <div className="flex items-center border-2 border-blue-300 rounded-xl overflow-hidden bg-white">
                <span className="bg-blue-50 text-blue-950 font-black px-3 py-2.5 border-r border-blue-300 select-none text-sm sm:text-base">
                  +34
                </span>
                <input
                  id="login-telefono"
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
          <label htmlFor="login-password" className="block text-sm font-bold mb-1">
            Contraseña *
          </label>
          <input
            id="login-password"
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
            <label htmlFor="login-tipo" className="block text-sm font-bold mb-1">
              ¿Cómo te registras? *
            </label>
            <select
              id="login-tipo"
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
          {enviando ? "Conectando..." : modo === "login" ? "Entrar" : "Crear Cuenta y Entrar"}
        </button>
      </form>

      {usuario && (
        <button
          type="button"
          onClick={() => {
            onLogout();
            onClose();
          }}
          className="w-full bg-stone-200 hover:bg-stone-300 text-stone-900 font-bold py-2.5 rounded-2xl text-sm"
        >
          Cerrar sesión ({usuario.nombre})
        </button>
      )}
    </div>
  );
}

export default function LoginModal() {
  const { modalLogin, setModalLogin, loginUsuario, registerUsuario, usuario, logoutUsuario } =
    useApp();

  const cerrarModal = useCallback(() => {
    setModalLogin({ open: false, defaultTipo: "REGISTRADO", motivo: "" });
  }, [setModalLogin]);

  return (
    <BaseModal
      open={modalLogin.open}
      onClose={cerrarModal}
      title="Acceso a PuebloVivo"
      maxWidthClass="max-w-md"
      containerClassName="bg-white text-stone-900 rounded-3xl w-full max-h-[90vh] overflow-y-auto p-5 shadow-2xl border-2 border-blue-700 space-y-3"
    >
      {modalLogin.open && (
        <LoginFormContent
          key={modalLogin.defaultTipo || "REGISTRADO"}
          defaultTipo={modalLogin.defaultTipo}
          motivo={modalLogin.motivo}
          usuario={usuario}
          onLogin={loginUsuario}
          onRegister={registerUsuario}
          onLogout={logoutUsuario}
          onClose={cerrarModal}
        />
      )}
    </BaseModal>
  );
}
