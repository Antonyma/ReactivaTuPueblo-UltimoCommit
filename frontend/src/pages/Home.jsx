import React from "react";
import { useApp } from "../context/useApp.js";
import TownFilter from "../components/TownFilter.jsx";
import ActivityList from "../components/ActivityList.jsx";
import MapView from "../components/MapView.jsx";
import MyPlans from "../components/MyPlans.jsx";
import PublisherPanel from "../components/PublisherPanel.jsx";
import ModeratorPanel from "../components/ModeratorPanel.jsx";
import AdminLogin from "../components/AdminLogin.jsx";

export default function Home() {
  const { usuario, rutaActual } = useApp();

  const esModerador = usuario && usuario.tipoUsuario === "MODERADOR";
  const esPublicador = usuario && usuario.tipoUsuario === "PUBLICADOR";
  const enRutaAdmin = rutaActual === "/admin";

  if (enRutaAdmin) {
    return (
      <main className="max-w-6xl mx-auto w-full px-3 sm:px-4 py-4 sm:py-5 flex-1 space-y-6">
        {esModerador ? <ModeratorPanel /> : <AdminLogin />}
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto w-full px-3 sm:px-4 py-4 sm:py-5 flex-1 space-y-5 sm:space-y-6">
      <div id="vista-general-comarca" className="space-y-5 sm:space-y-6">
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
