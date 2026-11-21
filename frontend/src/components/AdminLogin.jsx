import React, { useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { IconArrowLeft, IconShield } from "./Icons.jsx";

export default function AdminLogin() {
  const { loginAdmin, usuario, navegarA } = useApp();
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setEnviando(true);
    try {
      await loginAdmin({ nombre, password });
      setPassword("");
    } catch (err) {
      setErrorMsg(err.message || "Credenciales de administrador inválidas.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section
      id="vista-login-administrador"
      className="max-w-md mx-auto py-8 sm:py-12 px-2"
    >
      <div className="caja-panel bg-white text-stone-900 rounded-3xl shadow-xl border-2 border-blue-950 overflow-hidden">
        <div className="bg-blue-950 text-white p-6 space-y-2">
          <span className="bg-amber-400 text-stone-950 text-xs font-black uppercase px-3 py-1 rounded-full inline-block">
            Acceso Exclusivo · Administradores
          </span>
          <h1 className="text-2xl font-black flex items-center gap-2 pt-1">
            <IconShield className="w-6 h-6 text-amber-400 shrink-0" />
            <span>Panel de Administración</span>
          </h1>
          <p className="text-sm text-blue-100">
            Solo se permite el acceso con usuario y contraseña de administrador.
          </p>
        </div>

        <div className="p-6 space-y-4">
          {usuario && usuario.tipoUsuario !== "MODERADOR" && (
            <div className="bg-amber-50 border border-amber-300 text-amber-950 rounded-2xl p-3 text-xs sm:text-sm font-bold">
              La sesión actual (<strong>{usuario.nombre}</strong> · {usuario.tipoUsuario}) no tiene
              permisos de administrador. Inicia sesión con una cuenta de administrador.
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="bg-red-50 border border-red-300 text-red-900 rounded-2xl p-3 text-xs sm:text-sm font-bold"
            >
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label htmlFor="admin-nombre" className="block text-sm font-bold mb-1">
                Usuario administrador *
              </label>
              <input
                id="admin-nombre"
                type="text"
                required
                autoComplete="username"
                placeholder="Nombre de administrador"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full border-2 border-blue-300 rounded-xl p-2.5 text-base"
              />
            </div>

            <div>
              <label htmlFor="admin-password" className="block text-sm font-bold mb-1">
                Contraseña *
              </label>
              <input
                id="admin-password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="Contraseña de administrador"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border-2 border-blue-300 rounded-xl p-2.5 text-base"
              />
            </div>

            <button
              type="submit"
              disabled={enviando}
              className="w-full bg-blue-950 hover:bg-blue-900 disabled:opacity-60 text-white font-black py-3 rounded-2xl shadow"
            >
              {enviando ? "Verificando..." : "Entrar como Administrador"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => navegarA("/")}
            className="w-full inline-flex items-center justify-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold py-2.5 rounded-2xl text-sm"
          >
            <IconArrowLeft className="w-4 h-4" />
            <span>Volver a la web pública</span>
          </button>
        </div>
      </div>
    </section>
  );
}

