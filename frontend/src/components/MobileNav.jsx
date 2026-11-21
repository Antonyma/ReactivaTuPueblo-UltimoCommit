import React, { useState } from "react";
import { useApp } from "../context/AppContext.jsx";

export default function MobileNav() {
  const { setModalLogin } = useApp();
  const [tabActivo, setTabActivo] = useState("planes");

  const handleTabClick = (tab) => {
    setTabActivo(tab);
    if (tab === "cuenta") {
      setModalLogin({ open: true, defaultTipo: "REGISTRADO", motivo: "" });
    } else if (tab === "mapa") {
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
      className="md:hidden fixed bottom-0 inset-x-0 z-40 text-white border-t border-blue-800 grid grid-cols-4 shadow-2xl"
    >
      <button
        type="button"
        onClick={() => handleTabClick("planes")}
        className={`btn-movil-nav py-2.5 flex flex-col items-center justify-center text-xs ${
          tabActivo === "planes" ? "text-amber-300 font-black" : "text-blue-100 font-bold"
        }`}
      >
        <span className="text-xl">📅</span>
        <span>Planes</span>
      </button>

      <button
        type="button"
        onClick={() => handleTabClick("mapa")}
        className={`btn-movil-nav py-2.5 flex flex-col items-center justify-center text-xs ${
          tabActivo === "mapa" ? "text-amber-300 font-black" : "text-blue-100 font-bold"
        }`}
      >
        <span className="text-xl">🗺️</span>
        <span>Mapa</span>
      </button>

      <button
        type="button"
        onClick={() => handleTabClick("misplanes")}
        className={`btn-movil-nav py-2.5 flex flex-col items-center justify-center text-xs ${
          tabActivo === "misplanes" ? "text-amber-300 font-black" : "text-blue-100 font-bold"
        }`}
      >
        <span className="text-xl">✅</span>
        <span>Mis Planes</span>
      </button>

      <button
        type="button"
        onClick={() => handleTabClick("cuenta")}
        className={`btn-movil-nav py-2.5 flex flex-col items-center justify-center text-xs ${
          tabActivo === "cuenta" ? "text-amber-300 font-black" : "text-blue-100 font-bold"
        }`}
      >
        <span className="text-xl">👤</span>
        <span>Cuenta</span>
      </button>
    </nav>
  );
}
