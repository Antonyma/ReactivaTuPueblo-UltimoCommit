import React, { useMemo, useState } from "react";
import { useApp } from "../context/useApp.js";
import { municipiosMancomunidad } from "../constants/comarca.js";

const PUEBLOS_DESTACADOS = [
  { id: "Todos", nombre: "Todos" },
  { id: "Lucainena de las Torres", nombre: "Lucainena" },
  { id: "Velefique", nombre: "Velefique" },
  { id: "Senés", nombre: "Senés" },
  { id: "Uleila del Campo", nombre: "Uleila" },
];

const DESTACADOS_SET = new Set(PUEBLOS_DESTACADOS.map((p) => p.id));

export default function TownFilter() {
  const { puebloActivo, setPuebloActivo } = useApp();
  const [mostrarTodos, setMostrarTodos] = useState(false);

  const pueblosExtra = useMemo(
    () =>
      Object.keys(municipiosMancomunidad)
        .filter((nombre) => !DESTACADOS_SET.has(nombre))
        .sort((a, b) => a.localeCompare(b, "es"))
        .map((nombre) => ({ id: nombre, nombre })),
    []
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
      className="caja-panel bg-white p-4 rounded-3xl shadow-sm space-y-3"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-black">1. Elige tu pueblo:</p>
        <button
          type="button"
          onClick={() => setMostrarTodos((prev) => !prev)}
          aria-expanded={mostrarTodos}
          className="text-xs font-extrabold text-blue-700 hover:text-blue-900 underline underline-offset-2"
        >
          {mostrarTodos ? "Ver menos pueblos" : `Ver los ${pueblosExtra.length + 4} pueblos`}
        </button>
      </div>
      <div className="flex flex-wrap gap-2" id="grupo-pueblos" role="group" aria-label="Municipios">
        {listaVisible.map((p) => {
          const isActive = puebloActivo === p.id;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => setPuebloActivo(p.id)}
              className={`btn-pueblo px-4 py-2.5 rounded-2xl text-sm font-bold transition ${
                isActive
                  ? "bg-blue-950 text-white shadow-sm"
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
