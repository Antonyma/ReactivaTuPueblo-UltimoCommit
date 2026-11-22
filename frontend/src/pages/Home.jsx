import React, { useMemo } from "react";
import { useApp } from "../context/useApp.js";
import TownFilter from "../components/TownFilter.jsx";
import ActivityList from "../components/ActivityList.jsx";
import MapView from "../components/MapView.jsx";
import MyPlans from "../components/MyPlans.jsx";
import PublisherPanel from "../components/PublisherPanel.jsx";
import ModeratorPanel from "../components/ModeratorPanel.jsx";
import AdminLogin from "../components/AdminLogin.jsx";
import { IconCalendar, IconMap, IconMapPin } from "../components/Icons.jsx";

export default function Home() {
  const { usuario, rutaActual, actividades, municipiosMap, misInscripcionesIds } = useApp();

  const esModerador = usuario && usuario.tipoUsuario === "MODERADOR";
  const esPublicador = usuario && usuario.tipoUsuario === "PUBLICADOR";
  const enRutaAdmin = rutaActual === "/admin";

  const statsResumen = useMemo(() => {
    const visibles = actividades.filter((a) => a.estadoModeracion === "aprobada");
    const gratis = visibles.filter((a) => !a.dePago).length;
    return {
      totalPlanes: visibles.length,
      totalPueblos: Object.keys(municipiosMap || {}).length,
      totalGratis: gratis,
    };
  }, [actividades, municipiosMap]);

  const irASeccion = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (enRutaAdmin) {
    return (
      <main className="max-w-7xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-6 flex-1 space-y-6">
        {esModerador ? <ModeratorPanel /> : <AdminLogin />}
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-6 flex-1 space-y-5 sm:space-y-6">
      <div id="vista-general-comarca" className="space-y-5 sm:space-y-6">
        {/* Cabecera editorial compacta */}
        {!esPublicador && (
          <section
            aria-label="Bienvenida a PuebloVivo"
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#16324F] via-[#1B3B5C] to-[#23483B] text-white p-5 sm:p-7 border border-[#2B4D70] shadow-sm"
          >
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="space-y-1.5 max-w-2xl">
                <div className="inline-flex items-center gap-1.5 bg-[#3D5A3C] text-amber-200 border border-white/15 text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full">
                  <IconMapPin className="w-3.5 h-3.5 shrink-0" />
                  <span>Vida local y comercio rural</span>
                </div>
                <h1 className="font-serif font-extrabold text-2xl sm:text-3xl leading-tight text-white">
                  Descubre planes, fiestas y talleres en tu comarca
                </h1>
                <p className="text-sm sm:text-base text-blue-100/90 leading-relaxed">
                  Apúntate en un clic, consulta el mapa de los pueblos y apoya a los comercios de cercanía.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
                <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl px-3.5 py-2 text-center min-w-[82px]">
                  <p className="text-lg sm:text-xl font-extrabold text-amber-300 leading-none">
                    {statsResumen.totalPlanes}
                  </p>
                  <p className="text-[11px] font-semibold text-blue-100 mt-1">Planes</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl px-3.5 py-2 text-center min-w-[82px]">
                  <p className="text-lg sm:text-xl font-extrabold text-white leading-none">
                    {statsResumen.totalPueblos}
                  </p>
                  <p className="text-[11px] font-semibold text-blue-100 mt-1">Pueblos</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl px-3.5 py-2 text-center min-w-[82px]">
                  <p className="text-lg sm:text-xl font-extrabold text-emerald-300 leading-none">
                    {statsResumen.totalGratis}
                  </p>
                  <p className="text-[11px] font-semibold text-blue-100 mt-1">Gratis</p>
                </div>
              </div>
            </div>

            {/* Accesos rápidos en móvil/tablet hacia mapa y mis planes */}
            <div className="mt-4 pt-3.5 border-t border-white/15 flex flex-wrap gap-2 lg:hidden">
              <button
                type="button"
                onClick={() => irASeccion("tab-contenido-mapa")}
                className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
              >
                <IconMap className="w-4 h-4 text-amber-300" />
                <span>Ver mapa</span>
              </button>
              <button
                type="button"
                onClick={() => irASeccion("tab-contenido-misplanes")}
                className="inline-flex items-center gap-1.5 bg-[#C85A17] hover:bg-[#AD4B10] text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
              >
                <IconCalendar className="w-4 h-4" />
                <span>Mis planes ({misInscripcionesIds.length})</span>
              </button>
            </div>
          </section>
        )}

        {/* Panel de Publicador (si rol es PUBLICADOR) */}
        {esPublicador && <PublisherPanel />}

        {/* Filtro por Municipio */}
        <TownFilter />

        {/* Bloque central: Listado de Planes (8/12) + Mapa y Mis Planes sticky (4/12) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div id="tab-contenido-planes" className="lg:col-span-8 space-y-4 min-w-0">
            <ActivityList />
          </div>

          <aside className="lg:col-span-4 space-y-5 sm:space-y-6 lg:sticky lg:top-20 min-w-0">
            <MapView />
            <MyPlans />
          </aside>
        </div>
      </div>
    </main>
  );
}
