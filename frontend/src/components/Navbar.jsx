import React from "react";
import { useApp } from "../context/AppContext.jsx";

export default function Navbar() {
  const { letraGrande, setLetraGrande, usuario, setModalLogin } = useApp();

  const rolLabel = usuario
    ? `${usuario.tipoUsuario === "MODERADOR" ? "🛡️ Moderador: " : usuario.tipoUsuario === "PUBLICADOR" ? "📢 Publicador: " : "🏡 "}${usuario.nombre}`
    : "👤 Invitado";

  return (
    <header className="text-white sticky top-0 z-40 shadow-md">
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-2xl shrink-0">
            🏔️
          </div>
          <div>
            <span className="font-black text-xl block leading-none">PuebloVivo</span>
            <span className="text-xs text-blue-200 block mt-1">Filabres - Alhamilla</span>
          </div>
        </div>

        {/* SOLO BOTONES DE TAMAÑO DE LETRA */}
        <div
          className="flex items-center gap-2 bg-black/30 p-1.5 rounded-2xl border border-white/25"
          role="group"
          aria-label="Tamaño de letra"
        >
          <button
            type="button"
            onClick={() => setLetraGrande(false)}
            className={`btn-letra px-3.5 py-2 rounded-xl text-sm ${
              !letraGrande
                ? "bg-amber-400 text-stone-950 font-black"
                : "text-white hover:bg-white/15 font-bold"
            }`}
          >
            🅰️ Letra Normal
          </button>
          <button
            type="button"
            onClick={() => setLetraGrande(true)}
            className={`btn-letra px-3.5 py-2 rounded-xl text-sm ${
              letraGrande
                ? "bg-amber-400 text-stone-950 font-black"
                : "text-white hover:bg-white/15 font-bold"
            }`}
          >
            🔍 Letra Grande
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span
            id="badge-rol-actual"
            className="hidden sm:inline-block bg-black/30 border border-white/25 px-3 py-2 rounded-xl text-xs font-bold"
          >
            {rolLabel}
          </span>
          <button
            type="button"
            onClick={() =>
              setModalLogin({
                open: true,
                defaultTipo: usuario ? usuario.tipoUsuario : "REGISTRADO",
                motivo: usuario ? "Actualiza o cambia tu perfil y rol" : "Entra para apuntarte o gestionar eventos"
              })
            }
            className="bg-amber-400 hover:bg-amber-300 text-stone-950 font-black px-4 py-2.5 rounded-xl text-sm shadow"
          >
            👤 Entrar / Perfil
          </button>
        </div>
      </div>
    </header>
  );
}
