import React from "react";
import { useApp } from "../context/AppContext.jsx";

const PUEBLOS_FILTRO = [
  { id: "Todos", nombre: "Todos" },
  { id: "Lucainena de las Torres", nombre: "Lucainena" },
  { id: "Velefique", nombre: "Velefique" },
  { id: "Senés", nombre: "Senés" },
  { id: "Uleila del Campo", nombre: "Uleila" }
];

export default function TownFilter() {
  const { puebloActivo, setPuebloActivo } = useApp();

  return (
    <section id="seccion-filtros" className="caja-panel bg-white p-4 rounded-3xl shadow-sm space-y-3">
      <p className="text-sm font-black">1. Elige tu pueblo:</p>
      <div className="flex flex-wrap gap-2" id="grupo-pueblos">
        {PUEBLOS_FILTRO.map((p) => {
          const isActive = puebloActivo === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPuebloActivo(p.id)}
              className={`btn-pueblo px-4 py-2.5 rounded-2xl text-sm font-bold transition ${
                isActive
                  ? "bg-blue-950 text-white"
                  : "bg-blue-100 hover:bg-blue-200 text-blue-950"
              }`}
            >
              {p.nombre}
            </button>
          );
        })}
      </div>
    </section>
  );
}
