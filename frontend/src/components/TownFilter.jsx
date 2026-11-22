import React, { useMemo, useState } from "react";
import { useApp } from "../context/useApp.js";

const PUEBLOS_DESTACADOS = [
  { id: "Todos", nombre: "Todos" },
  { id: "Lucainena de las Torres", nombre: "Lucainena" },
  { id: "Velefique", nombre: "Velefique" },
  { id: "Senés", nombre: "Senés" },
  { id: "Uleila del Campo", nombre: "Uleila" },
];

const DESTACADOS_SET = new Set(PUEBLOS_DESTACADOS.map((p) => p.id));

export default function TownFilter() {
  const { puebloActivo, setPuebloActivo, municipiosMap } = useApp();
  const [mostrarTodos, setMostrarTodos] = useState(false);

  const pueblosExtra = useMemo(
    () =>
      Object.keys(municipiosMap)
        .filter((nombre) => !DESTACADOS_SET.has(nombre))
        .sort((a, b) => a.localeCompare(b, "es"))
        .map((nombre) => ({ id: nombre, nombre })),
    [municipiosMap]
  );

  const listaVisible = useMemo(() => {
    if (mostrarTodos) {
      return [...PUEBLOS_DESTACADOS, ...pueblosExtra];
    }
    if (!DESTACADOS_SET.has(puebloActivo)) {
      return [...PUEBLOS_DESTACADOS, { id: puebloActivo, nombre: puebloActivo }];
    }
    return PUEBLOS_DESTACADOS;
  }, [mostrarTodos, puebloActivo, pueblosExtra]);

  return (
    <section
      id="seccion-filtros"
      aria-label="Filtro por municipio"
      className="caja-panel bg-white p-3.5 sm:p-4 rounded space-y-3"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap border-b border-[#E5E2DC] pb-2">
        <p className="text-xs font-extrabold uppercase tracking-wider text-[#5E564D]">
          Municipios
        </p>
        <button
          type="button"
          onClick={() => setMostrarTodos((prev) => !prev)}
          aria-expanded={mostrarTodos}
          className="text-xs font-bold text-[#9A410E] hover:text-[#7C2D12] underline underline-offset-2"
        >
          {mostrarTodos ? "Ver menos pueblos" : `Ver los ${pueblosExtra.length + 4} pueblos`}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5" id="grupo-pueblos" role="group" aria-label="Municipios">
        {listaVisible.map((p) => {
          const isActive = puebloActivo === p.id;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => setPuebloActivo(p.id)}
              className={`btn-pueblo px-3.5 py-2 rounded text-sm font-bold border transition ${
                isActive
                  ? "bg-[#3D5A3C] text-white border-[#3D5A3C]"
                  : "bg-[#F4F3EF] hover:bg-[#E8E5DD] text-[#16324F] border-[#D6D3CD]"
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
