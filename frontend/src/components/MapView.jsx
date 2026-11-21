import React, { useEffect, useRef } from "react";
import { useApp } from "../context/AppContext.jsx";
import {
  municipiosMancomunidad,
  CENTRO_MANCOMUNIDAD,
  ZOOM_MANCOMUNIDAD,
  coordsPueblos,
} from "../constants/comarca.js";
import { IconMap, IconTarget } from "./Icons.jsx";

export default function MapView() {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const capaMarcadoresRef = useRef(null);

  const { actividades, puebloActivo, letraGrande } = useApp();

  // Inicializar mapa de OpenStreetMap con Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    if (typeof window.L === "undefined") {
      console.warn("Leaflet window.L no está disponible aún.");
      return;
    }

    const container = mapContainerRef.current;
    if (container._leaflet_id) {
      delete container._leaflet_id;
    }

    const L = window.L;
    const map = L.map(container, {
      center: CENTRO_MANCOMUNIDAD,
      zoom: ZOOM_MANCOMUNIDAD,
      minZoom: 9,
      maxZoom: 19,
    });

    // Capa OpenStreetMap
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const capaPueblos = L.layerGroup().addTo(map);
    const capaMarcadores = L.layerGroup().addTo(map);

    Object.entries(municipiosMancomunidad).forEach(([nombre, coords]) => {
      const icon = L.divIcon({
        className: "",
        html: `<div class="pin-pueblo-base"></div>`,
        iconSize: [11, 11],
        iconAnchor: [5, 5],
      });
      L.marker(coords, { icon }).addTo(capaPueblos).bindTooltip(nombre);
    });

    map.fitBounds(L.latLngBounds(Object.values(municipiosMancomunidad)), { padding: [20, 20] });

    mapInstanceRef.current = map;
    capaMarcadoresRef.current = capaMarcadores;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Redimensionar suavemente si cambia el modo de accesibilidad (letra grande)
  useEffect(() => {
    if (mapInstanceRef.current) {
      const timer = setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 180);
      return () => clearTimeout(timer);
    }
  }, [letraGrande]);

  // Actualizar pines cuando cambien las actividades o el pueblo activo
  useEffect(() => {
    if (!mapInstanceRef.current || !capaMarcadoresRef.current || typeof window.L === "undefined")
      return;

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
          iconAnchor: [24, 24],
        });
        L.marker(act.coords, { icon })
          .addTo(capa)
          .bindPopup(`<b>${act.nombre}</b><br/>${act.pueblo}<br/>${act.fecha}`)
          .on("click", () => {
            const cardEl = document.getElementById(`actividad-card-${act.id}`);
            if (!cardEl) return;
            cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
            cardEl.classList.add("ring-4", "ring-amber-400");
            window.setTimeout(() => {
              cardEl.classList.remove("ring-4", "ring-amber-400");
            }, 2200);
          });
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
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-black text-lg inline-flex items-center gap-2">
          <IconMap className="w-5 h-5 text-blue-700 shrink-0" />
          <span>Mapa de los Pueblos</span>
        </h2>
        <button
          type="button"
          onClick={centrarTodos}
          className="inline-flex items-center gap-1.5 bg-blue-950 text-amber-300 text-xs font-bold px-3 py-2 rounded-xl hover:bg-blue-900 transition shrink-0"
        >
          <IconTarget className="w-4 h-4" />
          <span>Ver todos</span>
        </button>
      </div>
      <div id="mapa-comarca" ref={mapContainerRef}></div>
    </div>
  );
}
