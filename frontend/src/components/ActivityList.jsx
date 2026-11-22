import React, { useMemo, useState } from "react";
import { useApp } from "../context/useApp.js";
import { TIPO_EVENTO_A_CATEGORIA } from "../constants/comarca.js";
import { useNow } from "../hooks/useNow.js";
import { getEstadoTemporal, getEventTimestamp } from "../utils/eventUtils.js";
import ActivityCard from "./ActivityCard.jsx";

const FILTROS_ESTADO = [
  { id: "todos", label: "Todos" },
  { id: "activos", label: "Activos" },
  { id: "por_venir", label: "Por venir" },
  { id: "finalizados", label: "Finalizados" },
];

const CATEGORIAS_OPCIONES = ["Todas", ...Object.values(TIPO_EVENTO_A_CATEGORIA)];

export default function ActivityList() {
  const { actividades, puebloActivo, setPuebloActivo, usuario, cargando } = useApp();
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [categoriaActiva, setCategoriaActiva] = useState("Todas");
  const [soloGratis, setSoloGratis] = useState(false);

  const ahoraMs = useNow(60000);
  const esPublicador = usuario && usuario.tipoUsuario === "PUBLICADOR";

  const listaBase = useMemo(() => {
    const query = busqueda.trim().toLowerCase();
    return actividades.filter((a) => {
      if (
        a.estadoModeracion === "denegada" ||
        a.estadoModeracion === "descartada" ||
        a.estadoModeracion === "pendiente_confirmacion"
      ) {
        return false;
      }
      if (a.estadoModeracion === "pendiente" && !esPublicador) return false;
      if (puebloActivo !== "Todos" && a.pueblo !== puebloActivo) return false;
      if (categoriaActiva !== "Todas" && a.categoria !== categoriaActiva) return false;
      if (soloGratis && a.dePago) return false;
      if (query) {
        const texto = `${a.nombre || ""} ${a.descripcion || ""} ${a.pueblo || ""} ${a.negocio || ""} ${a.categoria || ""}`.toLowerCase();
        if (!texto.includes(query)) return false;
      }
      return true;
    });
  }, [actividades, esPublicador, puebloActivo, categoriaActiva, soloGratis, busqueda]);

  const { conteos, lista } = useMemo(() => {
    const counts = {
      todos: listaBase.length,
      activos: 0,
      por_venir: 0,
      finalizados: 0,
    };
    const filtrada = [];
    for (const act of listaBase) {
      const est = getEstadoTemporal(act, ahoraMs);
      counts[est] += 1;
      if (filtroEstado === "todos" || est === filtroEstado) {
        filtrada.push({ act, est });
      }
    }

    const prioridadGrupo = ({ act, est }) => {
      if (est === "finalizados") return 2;
      if (act.esRecomendada || act.es_recomendada) return 0;
      return 1;
    };

    filtrada.sort((a, b) => {
      const gA = prioridadGrupo(a);
      const gB = prioridadGrupo(b);
      if (gA !== gB) return gA - gB;

      if (gA === 0) {
        const rankA =
          typeof a.act.ordenRecomendacion === "number"
            ? a.act.ordenRecomendacion
            : Number.MAX_SAFE_INTEGER;
        const rankB =
          typeof b.act.ordenRecomendacion === "number"
            ? b.act.ordenRecomendacion
            : Number.MAX_SAFE_INTEGER;
        if (rankA !== rankB) return rankA - rankB;
      }

      if (gA === 2) {
        const finA = getEventTimestamp(a.act.fechaFinMs, a.act.fechaFinISO) || 0;
        const finB = getEventTimestamp(b.act.fechaFinMs, b.act.fechaFinISO) || 0;
        return finB - finA;
      }

      const iniA =
        getEventTimestamp(a.act.fechaInicioMs, a.act.fechaInicioISO) || Number.MAX_SAFE_INTEGER;
      const iniB =
        getEventTimestamp(b.act.fechaInicioMs, b.act.fechaInicioISO) || Number.MAX_SAFE_INTEGER;
      return iniA - iniB;
    });

    return { conteos: counts, lista: filtrada.map((item) => item.act) };
  }, [listaBase, ahoraMs, filtroEstado]);

  const hayFiltrosExtra =
    busqueda.trim() !== "" || categoriaActiva !== "Todas" || soloGratis || filtroEstado !== "todos";

  const limpiarFiltros = () => {
    setBusqueda("");
    setCategoriaActiva("Todas");
    setSoloGratis(false);
    setFiltroEstado("todos");
  };

  if (cargando && actividades.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5" aria-busy="true" aria-label="Cargando actividades">
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm animate-pulse"
          >
            <div className="h-44 sm:h-48 bg-slate-200" />
            <div className="p-5 space-y-3">
              <div className="h-3.5 bg-slate-200 rounded w-1/2" />
              <div className="h-5 bg-slate-200 rounded w-4/5" />
              <div className="h-3.5 bg-slate-200 rounded w-full" />
              <div className="h-10 bg-slate-200 rounded-2xl w-full mt-4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white p-3.5 rounded border border-[#D6D3CD] space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <label htmlFor="buscador-actividades" className="sr-only">
              Buscar actividades
            </label>
            <input
              id="buscador-actividades"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, pueblo, comercio..."
              className="w-full px-3.5 py-2 rounded border border-[#C9C4BA] bg-white text-sm font-medium focus:outline-none focus:border-[#16324F]"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="filtro-categoria" className="sr-only">
              Filtrar por categoría
            </label>
            <select
              id="filtro-categoria"
              value={categoriaActiva}
              onChange={(e) => setCategoriaActiva(e.target.value)}
              className="px-3 py-2 rounded border border-[#C9C4BA] bg-white text-xs sm:text-sm font-bold text-[#16324F] focus:outline-none focus:border-[#16324F]"
            >
              {CATEGORIAS_OPCIONES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === "Todas" ? "Todas las categorías" : cat}
                </option>
              ))}
            </select>

            <button
              type="button"
              aria-pressed={soloGratis}
              onClick={() => setSoloGratis((prev) => !prev)}
              className={`px-3 py-2 rounded text-xs sm:text-sm font-bold border transition shrink-0 ${
                soloGratis
                  ? "bg-[#3D5A3C] text-white border-[#3D5A3C]"
                  : "bg-[#F4F3EF] hover:bg-[#E8E5DD] text-[#2F5233] border-[#C9C4BA]"
              }`}
            >
              Solo gratis
            </button>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Filtrar actividades por estado"
          className="flex flex-wrap items-center gap-4 border-t border-[#E5E2DC] pt-2.5"
        >
          {FILTROS_ESTADO.map((f) => {
            const activo = filtroEstado === f.id;
            return (
              <button
                key={f.id}
                id={`tab-estado-${f.id}`}
                type="button"
                role="tab"
                aria-selected={activo}
                aria-controls="panel-actividades"
                onClick={() => setFiltroEstado(f.id)}
                className={`inline-flex items-center gap-1.5 pb-1.5 text-xs sm:text-sm font-bold border-b-2 transition ${
                  activo
                    ? "border-[#3D5A3C] text-[#16324F]"
                    : "border-transparent text-[#5E564D] hover:text-[#16324F]"
                }`}
              >
                <span>{f.label}</span>
                <span
                  className={`text-[11px] font-bold px-1.5 py-0.5 rounded-sm ${
                    activo ? "bg-[#3D5A3C] text-white" : "bg-[#EAE8E1] text-[#16324F]"
                  }`}
                >
                  {conteos[f.id]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        id="panel-actividades"
        role="tabpanel"
        aria-labelledby={`tab-estado-${filtroEstado}`}
      >
        {lista.length === 0 ? (
          <div className="bg-white p-8 rounded text-center border border-[#D6D3CD] space-y-3">
            <p className="text-lg font-bold">
              {hayFiltrosExtra
                ? "No hay actividades que coincidan con tus filtros."
                : "No hay actividades en este pueblo ahora mismo."}
            </p>
            <p className="text-sm text-stone-600">
              {hayFiltrosExtra
                ? "Prueba a limpiar la búsqueda o cambiar de categoría o estado."
                : 'Pulsa "Todos" para ver los planes de toda la comarca.'}
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              {hayFiltrosExtra && (
                <button
                  type="button"
                  onClick={limpiarFiltros}
                  className="bg-[#C85A17] hover:bg-[#AD4B10] text-white font-bold px-4 py-2 rounded text-sm"
                >
                  Limpiar filtros
                </button>
              )}
              {puebloActivo !== "Todos" && (
                <button
                  type="button"
                  onClick={() => setPuebloActivo("Todos")}
                  className="bg-[#F4F3EF] hover:bg-[#E8E5DD] text-[#16324F] border border-[#D6D3CD] font-bold px-4 py-2 rounded text-sm"
                >
                  Ver toda la comarca
                </button>
              )}
            </div>
          </div>
        ) : (
          <div id="grid-actividades" className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {lista.map((act) => (
              <ActivityCard key={act.id} act={act} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
