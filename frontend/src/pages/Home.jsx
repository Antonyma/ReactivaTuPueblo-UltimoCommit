import React from "react";
import { useApp } from "../context/AppContext.jsx";
import TownFilter from "../components/TownFilter.jsx";
import ActivityList from "../components/ActivityList.jsx";
import MapView from "../components/MapView.jsx";
import MyPlans from "../components/MyPlans.jsx";
import PublisherPanel from "../components/PublisherPanel.jsx";
import ModeratorPanel from "../components/ModeratorPanel.jsx";
import { IconMegaphone } from "../components/Icons.jsx";

export default function Home() {
  const { usuario, cambiarRol } = useApp();

  const esModerador = usuario && usuario.tipoUsuario === "MODERADOR";
  const esPublicador = usuario && usuario.tipoUsuario === "PUBLICADOR";

  const subtitulo = usuario
    ? esPublicador
      ? `Hola ${usuario.nombre}, gestiona tus eventos o apúntate a otros planes.`
      : `Hola ${usuario.nombre}, pulsa el botón azul en cualquier plan para apuntarte.`
    : "Elige un plan de abajo y pulsa el botón azul para apuntarte.";

  if (esModerador) {
    return (
      <main className="max-w-6xl mx-auto w-full px-3 sm:px-4 py-4 sm:py-5 flex-1 space-y-6">
        <ModeratorPanel />
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto w-full px-3 sm:px-4 py-4 sm:py-5 flex-1 space-y-5 sm:space-y-6">
      <div id="vista-general-comarca" className="space-y-5 sm:space-y-6">
        {/* Cabecera de bienvenida y acceso rápido a roles */}
        <div className="caja-panel bg-white p-4 sm:p-5 rounded-3xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black leading-tight">
              ¿Qué hacemos hoy en el pueblo?
            </h1>
            <p id="subtitulo-estado-usuario" className="text-sm text-stone-600 mt-1">
              {subtitulo}
            </p>
            <p className="text-xs font-bold text-blue-900 mt-1">
              Tipo de usuario actual: {usuario ? usuario.tipoUsuario : "NO_REGISTRADO"}
            </p>
          </div>

          {!esPublicador && (
            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              <button
                type="button"
                onClick={() => cambiarRol("PUBLICADOR")}
                className="inline-flex items-center justify-center gap-2 bg-blue-950 hover:bg-blue-900 text-white font-bold px-4 py-3 rounded-2xl text-sm w-full sm:w-auto"
              >
                <IconMegaphone className="w-4 h-4 shrink-0" />
                <span>Soy Negocio / Publicador</span>
              </button>
            </div>
          )}
        </div>

        {/* Panel de Publicador (si rol es PUBLICADOR) */}
        {esPublicador && <PublisherPanel />}

        {/* Filtro por Municipio */}
        <TownFilter />

        {/* Bloque central: Listado de Planes (2/3) + Mapa y Mis Planes (1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
          <div id="tab-contenido-planes" className="lg:col-span-2 space-y-4">
            <ActivityList />
          </div>

          <div className="space-y-5 sm:space-y-6">
            <MapView />
            <MyPlans />
          </div>
        </div>
      </div>
    </main>
  );
}
