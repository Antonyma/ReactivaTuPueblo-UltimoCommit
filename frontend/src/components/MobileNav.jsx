import React, { useState } from "react";
import { useApp } from "../context/useApp.js";
import { IconCalendar, IconCheck, IconMap, IconMessage, IconUser } from "./Icons.jsx";

export default function MobileNav() {
  const { setModalLogin, usuario, misInscripcionesIds } = useApp();
  const [tabActivo, setTabActivo] = useState("planes");
  const mostrarChat = usuario?.tipoUsuario !== "MODERADOR";

  const handleTabClick = (tab) => {
    if (tab === "chat") {
      window.dispatchEvent(new CustomEvent("pueblovivo:toggle-chat"));
      return;
    }
    if (tab === "cuenta") {
      setModalLogin({
        open: true,
        defaultTipo: usuario ? usuario.tipoUsuario : "REGISTRADO",
        motivo: "",
      });
      return;
    }
    setTabActivo(tab);
    if (tab === "mapa") {
      const el = document.getElementById("tab-contenido-mapa");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    } else if (tab === "misplanes") {
      const el = document.getElementById("tab-contenido-misplanes");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <nav
      id="nav-inferior-movil"
      className={`md:hidden fixed bottom-0 inset-x-0 z-40 text-white border-t border-[#264A70] grid ${
        mostrarChat ? "grid-cols-5" : "grid-cols-4"
      } shadow-2xl`}
    >
      <button
        type="button"
        onClick={() => handleTabClick("planes")}
        className={`btn-movil-nav py-2.5 flex flex-col items-center justify-center gap-1 text-[11px] ${
          tabActivo === "planes" ? "text-amber-300 font-black" : "text-blue-100 font-bold"
        }`}
      >
        <IconCalendar className="w-5 h-5" />
        <span>Planes</span>
      </button>

      <button
        type="button"
        onClick={() => handleTabClick("mapa")}
        className={`btn-movil-nav py-2.5 flex flex-col items-center justify-center gap-1 text-[11px] ${
          tabActivo === "mapa" ? "text-amber-300 font-black" : "text-blue-100 font-bold"
        }`}
      >
        <IconMap className="w-5 h-5" />
        <span>Mapa</span>
      </button>

      <button
        type="button"
        onClick={() => handleTabClick("misplanes")}
        className={`btn-movil-nav relative py-2.5 flex flex-col items-center justify-center gap-1 text-[11px] ${
          tabActivo === "misplanes" ? "text-amber-300 font-black" : "text-blue-100 font-bold"
        }`}
      >
        <div className="relative">
          <IconCheck className="w-5 h-5" />
          {misInscripcionesIds.length > 0 && (
            <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#C85A17] text-white text-[10px] font-black flex items-center justify-center">
              {misInscripcionesIds.length}
            </span>
          )}
        </div>
        <span>Mis Planes</span>
      </button>

      {mostrarChat && (
        <button
          type="button"
          onClick={() => handleTabClick("chat")}
          className="btn-movil-nav py-2.5 flex flex-col items-center justify-center gap-1 text-[11px] text-amber-300 font-black"
        >
          <IconMessage className="w-5 h-5" />
          <span>Guía IA</span>
        </button>
      )}

      <button
        type="button"
        onClick={() => handleTabClick("cuenta")}
        className={`btn-movil-nav py-2.5 flex flex-col items-center justify-center gap-1 text-[11px] ${
          tabActivo === "cuenta" ? "text-amber-300 font-black" : "text-blue-100 font-bold"
        }`}
      >
        <IconUser className="w-5 h-5" />
        <span>Cuenta</span>
      </button>
    </nav>
  );
}
