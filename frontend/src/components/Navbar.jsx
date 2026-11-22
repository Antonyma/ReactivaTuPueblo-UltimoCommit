import React, { useState } from "react";
import { useApp } from "../context/useApp.js";
import {
  IconArrowLeft,
  IconClose,
  IconMenu,
  IconMountain,
  IconTextSize,
  IconUser,
} from "./Icons.jsx";

export default function Navbar() {
  const { letraGrande, setLetraGrande, usuario, setModalLogin, logoutUsuario, rutaActual, navegarA } =
    useApp();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const enRutaAdmin = rutaActual === "/admin";
  const esModerador = usuario?.tipoUsuario === "MODERADOR";

  const rolTexto = usuario
    ? `${usuario.nombre} · [${usuario.tipoUsuario}]`
    : "Invitado · [NO_REGISTRADO]";

  const abrirCuenta = () => {
    setMenuAbierto(false);
    setModalLogin({
      open: true,
      defaultTipo: "REGISTRADO",
      motivo: "Entra para apuntarte o gestionar eventos",
    });
  };

  const cerrarSesion = () => {
    setMenuAbierto(false);
    logoutUsuario();
  };

  return (
    <header className="text-white sticky top-0 z-40 shadow-md">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-blue-600 flex items-center justify-center shrink-0">
            <IconMountain className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <span className="font-black text-lg sm:text-xl block leading-none truncate">
              PuebloVivo
            </span>
            <span className="text-xs text-blue-200 block mt-1 truncate">
              Filabres - Alhamilla
            </span>
          </div>
        </div>

        {/* Controles escritorio */}
        <div className="hidden md:flex items-center gap-3">
          <div
            className="flex items-center gap-1.5 bg-black/30 p-1.5 rounded-2xl border border-white/25"
            role="group"
            aria-label="Tamaño de letra"
          >
            <button
              type="button"
              aria-pressed={!letraGrande}
              onClick={() => setLetraGrande(false)}
              className={`btn-letra inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm ${
                !letraGrande
                  ? "bg-amber-400 text-stone-950 font-black"
                  : "text-white hover:bg-white/15 font-bold"
              }`}
            >
              <IconTextSize className="w-4 h-4" />
              <span>Letra Normal</span>
            </button>
            <button
              type="button"
              aria-pressed={letraGrande}
              onClick={() => setLetraGrande(true)}
              className={`btn-letra inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm ${
                letraGrande
                  ? "bg-amber-400 text-stone-950 font-black"
                  : "text-white hover:bg-white/15 font-bold"
              }`}
            >
              <IconTextSize className="w-5 h-5" />
              <span>Letra Grande</span>
            </button>
          </div>

          <span
            id="badge-rol-actual"
            className="bg-black/30 border border-white/25 px-3 py-2 rounded-xl text-xs font-bold max-w-[180px] truncate"
          >
            {rolTexto}
          </span>

          {enRutaAdmin ? (
            <>
              <button
                type="button"
                onClick={() => navegarA("/")}
                className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white font-bold px-4 py-2.5 rounded-xl text-sm shrink-0"
              >
                <IconArrowLeft className="w-4 h-4" />
                <span>Web pública</span>
              </button>
              {usuario && (
                <button
                  type="button"
                  onClick={cerrarSesion}
                  className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-black px-4 py-2.5 rounded-xl text-sm shadow shrink-0"
                >
                  <span>Cerrar sesión</span>
                </button>
              )}
            </>
          ) : (
            <>
              {esModerador && (
                <button
                  type="button"
                  onClick={() => navegarA("/admin")}
                  className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-stone-950 font-black px-4 py-2.5 rounded-xl text-sm shadow shrink-0"
                >
                  <span>Panel Admin</span>
                </button>
              )}
              {usuario ? (
                <button
                  type="button"
                  onClick={cerrarSesion}
                  className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-black px-4 py-2.5 rounded-xl text-sm shadow shrink-0"
                >
                  <IconArrowLeft className="w-4 h-4" />
                  <span>Cerrar sesión</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={abrirCuenta}
                  className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-stone-950 font-black px-4 py-2.5 rounded-xl text-sm shadow shrink-0"
                >
                  <IconUser className="w-4 h-4" />
                  <span>Entrar / Perfil</span>
                </button>
              )}
            </>
          )}
        </div>

        {/* Botón hamburguesa móvil */}
        <button
          type="button"
          onClick={() => setMenuAbierto((prev) => !prev)}
          aria-expanded={menuAbierto}
          aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
          className="md:hidden inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-stone-950 font-black px-3.5 py-2.5 rounded-xl text-sm shadow shrink-0"
        >
          {menuAbierto ? (
            <IconClose className="w-5 h-5" />
          ) : (
            <IconMenu className="w-5 h-5" />
          )}
          <span>{menuAbierto ? "Cerrar" : "Menú"}</span>
        </button>
      </div>

      {/* Menú desplegable móvil */}
      {menuAbierto && (
        <div className="md:hidden border-t border-white/20 bg-blue-950 px-4 py-4 space-y-3">
          <div className="bg-black/25 border border-white/20 rounded-2xl px-4 py-2.5 text-sm font-bold flex items-center gap-2">
            <IconUser className="w-4 h-4 text-amber-300 shrink-0" />
            <span className="truncate">Sesión: {rolTexto}</span>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-bold text-blue-200 uppercase tracking-wide">
              Tamaño de letra
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setLetraGrande(false);
                  setMenuAbierto(false);
                }}
                className={`inline-flex items-center justify-center gap-1.5 py-3 px-3 rounded-xl text-sm ${
                  !letraGrande
                    ? "bg-amber-400 text-stone-950 font-black"
                    : "bg-white/10 text-white font-bold"
                }`}
              >
                <IconTextSize className="w-4 h-4" />
                <span>Normal</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLetraGrande(true);
                  setMenuAbierto(false);
                }}
                className={`inline-flex items-center justify-center gap-1.5 py-3 px-3 rounded-xl text-sm ${
                  letraGrande
                    ? "bg-amber-400 text-stone-950 font-black"
                    : "bg-white/10 text-white font-bold"
                }`}
              >
                <IconTextSize className="w-5 h-5" />
                <span>Grande</span>
              </button>
            </div>
          </div>

          {enRutaAdmin ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setMenuAbierto(false);
                  navegarA("/");
                }}
                className="w-full inline-flex items-center justify-center gap-2 bg-white/15 hover:bg-white/25 text-white font-bold py-3.5 px-4 rounded-2xl text-base"
              >
                <IconArrowLeft className="w-5 h-5" />
                <span>Volver a la web pública</span>
              </button>
              {usuario && (
                <button
                  type="button"
                  onClick={cerrarSesion}
                  className="w-full inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-black py-3.5 px-4 rounded-2xl text-base shadow"
                >
                  <IconArrowLeft className="w-5 h-5" />
                  <span>Cerrar sesión</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {esModerador && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuAbierto(false);
                    navegarA("/admin");
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 text-stone-950 font-black py-3.5 px-4 rounded-2xl text-base shadow"
                >
                  <span>Panel Admin</span>
                </button>
              )}
              {usuario ? (
                <button
                  type="button"
                  onClick={cerrarSesion}
                  className="w-full inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-black py-3.5 px-4 rounded-2xl text-base shadow"
                >
                  <IconArrowLeft className="w-5 h-5" />
                  <span>Cerrar sesión</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={abrirCuenta}
                  className="w-full inline-flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 text-stone-950 font-black py-3.5 px-4 rounded-2xl text-base shadow"
                >
                  <IconUser className="w-5 h-5" />
                  <span>Entrar o Registrarme</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
