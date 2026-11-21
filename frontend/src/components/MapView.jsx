import React, { useEffect, useRef } from "react";
import { useApp } from "../context/AppContext.jsx";
import {
  municipiosMancomunidad,
  CENTRO_MANCOMUNIDAD,
  ZOOM_MANCOMUNIDAD,
  coordsPueblos
} from "../data/mockData.js";

export default function MapView() {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const capaMarcadoresRef = useRef(null);

  const { actividades, puebloActivo } = useApp();

  // Inicializar mapa de OpenStreetMap con Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    if (typeof window.L === "undefined") {
      console.warn("Leaflet window.L no está disponible aún.");
      return;
    }

    const L = window.L;
    const map = L.map(mapContainerRef.current, {
      center: CENTRO_MANCOMUNIDAD,
      zoom: ZOOM_MANCOMUNIDAD,
      minZoom: 9,
      maxZoom: 19
    });

    // Capa OpenStreetMap
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const capaPueblos = L.layerGroup().addTo(map);
    const capaMarcadores = L.layerGroup().addTo(map);

    Object.entries(municipiosMancomunidad).forEach(([nombre, coords]) => {
      const icon = L.divIcon({
        className: "",
        html: `<div class="pin-pueblo-base"></div>`,
        iconSize: [11, 11],
        iconAnchor: [5, 5]
      });
      L.marker(coords, { icon }).addTo(capaPueblos).bindTooltip(nombre);
    });

    map.fitBounds(L.latLngBounds(Object.values(municipiosMancomunidad)), { padding: [20, 20] });

    mapInstanceRef.current = map;
    capaMarcadoresRef.current = capaMarcadores;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Actualizar pines cuando cambien las actividades o el pueblo activo
  useEffect(() => {
    if (!mapInstanceRef.current || !capaMarcadoresRef.current || typeof window.L === "undefined") return;

    const L = window.L;
    const capa = capaMarcadoresRef.current;
    capa.clearLayers();

    actividades
      .filter((a) => a.estadoModeracion === "aprobada")
      .forEach((act) => {
        if (puebloActivo !== "Todos" && act.pueblo !== puebloActivo) return;
        const icon = L.divIcon({
          className: "",
          html: `<div class="pin-actividad-foto"><img src="${act.imagen}" alt="${act.nombre}" /></div>`,
          iconSize: [48, 48],
          iconAnchor: [24, 24]
        });
        L.marker(act.coords, { icon })
          .addTo(capa)
          .bindPopup(`<b>${act.nombre}</b><br/>📍 ${act.pueblo}<br/>🕒 ${act.fecha}`);
      });
  }, [actividades, puebloActivo]);

  // Actualizar vista según el pueblo seleccionado
  useEffect(() => {
    if (!mapInstanceRef.current || typeof window.L === "undefined") return;

    const map = mapInstanceRef.current;
    const L = window.L;

    if (puebloActivo === "Todos") {
      map.fitBounds(L.latLngBounds(Object.values(municipiosMancomunidad)), { padding: [20, 20] });
    } else if (coordsPueblos[puebloActivo]) {
      map.setView(coordsPueblos[puebloActivo].center, coordsPueblos[puebloActivo].zoom);
    }
  }, [puebloActivo]);

  const centrarTodos = () => {
    if (!mapInstanceRef.current || typeof window.L === "undefined") return;
    const map = mapInstanceRef.current;
    const L = window.L;
    map.fitBounds(L.latLngBounds(Object.values(municipiosMancomunidad)), { padding: [20, 20] });
  };

  return (
    <div id="tab-contenido-mapa" className="caja-panel bg-white p-4 rounded-3xl shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-black text-lg">🗺️ Mapa de los Pueblos</h2>
        <button
          type="button"
          onClick={centrarTodos}
          className="bg-blue-950 text-amber-300 text-xs font-bold px-3 py-2 rounded-xl hover:bg-blue-900 transition"
        >
          🎯 Ver todos
        </button>
      </div>
      <div id="mapa-comarca" ref={mapContainerRef}></div>
    </div>
  );
}
