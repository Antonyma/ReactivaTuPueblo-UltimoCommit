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
      <div className="grid grid-cols-2 gap-1.5 bg-[#F4F3EF] p-1 rounded border border-[#D6D3CD]">
        <button
          type="button"
          onClick={() => setModo("login")}
          className={`py-2 rounded-sm text-sm font-bold ${
            modo === "login" ? "bg-[#16324F] text-white" : "text-[#16324F]"
          }`}
        >
          Entrar
        </button>
        <button
          type="button"
          onClick={() => setModo("register")}
          className={`py-2 rounded-sm text-sm font-bold ${
            modo === "register" ? "bg-[#16324F] text-white" : "text-[#16324F]"
          }`}
        >
          Registrarme
        </button>
      </div>

      <p className="text-xs sm:text-sm text-[#16324F] bg-[#F4F3EF] border-l-4 border-[#3D5A3C] p-2.5 rounded-sm">
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
            className="w-full border border-[#C9C4BA] focus:border-[#16324F] outline-none rounded p-2.5 text-base"
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
                className="w-full border border-[#C9C4BA] focus:border-[#16324F] outline-none rounded p-2.5 text-base"
              />
            </div>

            <div>
              <label htmlFor="login-telefono" className="block text-sm font-bold mb-1">
                Teléfono WhatsApp *
              </label>
              <div className="flex items-center border border-[#C9C4BA] focus-within:border-[#16324F] rounded overflow-hidden bg-white">
                <span className="bg-[#F4F3EF] text-[#16324F] font-bold px-3 py-2.5 border-r border-[#C9C4BA] select-none text-sm sm:text-base">
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
            className="w-full border border-[#C9C4BA] focus:border-[#16324F] outline-none rounded p-2.5 text-base"
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
              className="w-full border border-[#C9C4BA] focus:border-[#16324F] outline-none rounded p-2.5 font-bold bg-white text-base"
            >
              <option value="REGISTRADO">Visitante</option>
              <option value="PUBLICADOR">Publicador</option>
            </select>
          </div>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="w-full bg-[#C85A17] hover:bg-[#AD4B10] disabled:opacity-60 text-white font-bold py-2.5 rounded mt-1"
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
          className="w-full bg-[#F4F3EF] hover:bg-[#E8E5DD] text-[#16324F] border border-[#D6D3CD] font-bold py-2 rounded text-sm"
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
      containerClassName="bg-white text-stone-900 rounded w-full max-h-[90vh] overflow-y-auto p-5 shadow-2xl border border-[#16324F] border-t-4 border-t-[#3D5A3C] space-y-3"
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
