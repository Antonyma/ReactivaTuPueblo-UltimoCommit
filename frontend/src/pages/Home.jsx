import React from "react";
import { useApp } from "../context/AppContext.jsx";
import TownFilter from "../components/TownFilter.jsx";
import ActivityList from "../components/ActivityList.jsx";
import MapView from "../components/MapView.jsx";
import MyPlans from "../components/MyPlans.jsx";
import PublisherPanel from "../components/PublisherPanel.jsx";
import ModeratorPanel from "../components/ModeratorPanel.jsx";

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
      <main className="max-w-6xl mx-auto w-full px-4 py-5 flex-1 space-y-6">
        <ModeratorPanel />
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto w-full px-4 py-5 flex-1 space-y-6">
      <div id="vista-general-comarca" className="space-y-6">
        {/* Cabecera de bienvenida y acceso rápido a roles */}
        <div className="caja-panel bg-white p-4 rounded-3xl shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-black">¿Qué hacemos hoy en el pueblo?</h1>
            <p id="subtitulo-estado-usuario" className="text-sm text-stone-600">
              {subtitulo}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {!esPublicador && (
              <button
                type="button"
                onClick={() => cambiarRol("PUBLICADOR")}
                className="bg-blue-950 hover:bg-blue-900 text-white font-bold px-4 py-3 rounded-2xl text-sm"
              >
                📢 Soy Negocio / Publicador
              </button>
            )}
            <button
              type="button"
              onClick={() => cambiarRol("MODERADOR")}
              className="bg-blue-100 hover:bg-blue-200 text-blue-950 font-bold px-4 py-3 rounded-2xl text-sm"
            >
              🛡️ Soy Moderador
            </button>
          </div>
        </div>

        {/* Panel de Publicador (si rol es PUBLICADOR) */}
        {esPublicador && <PublisherPanel />}

        {/* Filtro por Municipio */}
        <TownFilter />

        {/* Bloque central: Listado de Planes (2/3) + Mapa y Mis Planes (1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div id="tab-contenido-planes" className="lg:col-span-2 space-y-4">
            <ActivityList />
          </div>

          <div className="space-y-6">
            <MapView />
            <MyPlans />
          </div>
        </div>
      </div>
    </main>
  );
}
