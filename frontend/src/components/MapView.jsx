import React, { useEffect, useMemo, useRef } from "react";
import { useApp } from "../context/useApp.js";
import {
  CENTRO_MANCOMUNIDAD,
  ZOOM_MANCOMUNIDAD,
  coordsPueblos,
} from "../constants/comarca.js";
import { DEFAULT_IMAGE, escapeHtml, esUrlImagenSegura } from "../utils/eventUtils.js";
import { IconMap, IconTarget } from "./Icons.jsx";

export default function MapView() {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const capaPueblosRef = useRef(null);
  const capaMarcadoresRef = useRef(null);

  const { actividades, puebloActivo, letraGrande, municipiosMap } = useApp();

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

    mapInstanceRef.current = map;
    capaPueblosRef.current = capaPueblos;
    capaMarcadoresRef.current = capaMarcadores;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !capaPueblosRef.current || typeof window.L === "undefined") {
      return;
    }
    const L = window.L;
    const capaPueblos = capaPueblosRef.current;
    capaPueblos.clearLayers();
    Object.entries(municipiosMap).forEach(([nombre, coords]) => {
      const icon = L.divIcon({
        className: "",
        html: `<div class="pin-pueblo-base"></div>`,
        iconSize: [11, 11],
        iconAnchor: [5, 5],
      });
      L.marker(coords, { icon }).addTo(capaPueblos).bindTooltip(nombre);
    });
  }, [municipiosMap]);

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

  const marcadoresVisibles = useMemo(
    () =>
      actividades
        .filter((a) => a.estadoModeracion === "aprobada")
        .filter((a) => puebloActivo === "Todos" || a.pueblo === puebloActivo),
    [actividades, puebloActivo]
  );

  // Actualizar pines cuando cambien las actividades aprobadas o el pueblo activo
  useEffect(() => {
    if (!mapInstanceRef.current || !capaMarcadoresRef.current || typeof window.L === "undefined")
      return;

    const L = window.L;
    const capa = capaMarcadoresRef.current;
    capa.clearLayers();

    marcadoresVisibles.forEach((act) => {
      const imgSrc = esUrlImagenSegura(act.imagen) ? escapeHtml(act.imagen) : DEFAULT_IMAGE;
      const nombreSafe = escapeHtml(act.nombre);
      const puebloSafe = escapeHtml(act.pueblo);
      const fechaSafe = escapeHtml(act.fecha);

      const icon = L.divIcon({
        className: "",
        html: `<div class="pin-actividad-foto"><img src="${imgSrc}" alt="${nombreSafe}" loading="lazy" /></div>`,
        iconSize: [48, 48],
        iconAnchor: [24, 24],
      });
      L.marker(act.coords, { icon })
        .addTo(capa)
        .bindPopup(`<b>${nombreSafe}</b><br/>${puebloSafe}<br/>${fechaSafe}`)
        .on("click", () => {
          const cardEl =
            document.getElementById(`actividad-card-${act.id}`) ||
            document.getElementById("grid-actividades");
          if (!cardEl) return;
          cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
          if (cardEl.id === `actividad-card-${act.id}`) {
            cardEl.classList.add("ring-4", "ring-amber-400", "bg-amber-50");
            window.setTimeout(() => {
              cardEl.classList.remove("ring-4", "ring-amber-400", "bg-amber-50");
            }, 3500);
          }
        });
    });
  }, [marcadoresVisibles]);

  // Actualizar vista según el pueblo seleccionado
  useEffect(() => {
    if (!mapInstanceRef.current || typeof window.L === "undefined") return;

    const map = mapInstanceRef.current;
    const L = window.L;

    if (puebloActivo === "Todos") {
      map.fitBounds(L.latLngBounds(Object.values(municipiosMap)), { padding: [20, 20] });
    } else if (municipiosMap[puebloActivo]) {
      map.setView(municipiosMap[puebloActivo], 14);
    } else if (coordsPueblos[puebloActivo]) {
      map.setView(coordsPueblos[puebloActivo].center, coordsPueblos[puebloActivo].zoom);
    }
  }, [puebloActivo, municipiosMap]);

  const centrarTodos = () => {
    if (!mapInstanceRef.current || typeof window.L === "undefined") return;
    const map = mapInstanceRef.current;
    const L = window.L;
    map.fitBounds(L.latLngBounds(Object.values(municipiosMap)), { padding: [20, 20] });
  };

  return (
    <div id="tab-contenido-mapa" className="caja-panel bg-white p-4 rounded border-t-4 border-t-[#16324F] space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold text-lg inline-flex items-center gap-2">
          <IconMap className="w-5 h-5 text-[#3D5A3C] shrink-0" />
          <span>Mapa de los Pueblos</span>
        </h2>
        <button
          type="button"
          onClick={centrarTodos}
          className="inline-flex items-center gap-1.5 bg-[#16324F] text-amber-300 text-xs font-bold px-3 py-1.5 rounded hover:bg-[#1E4268] transition shrink-0"
        >
          <IconTarget className="w-4 h-4" />
          <span>Ver todos</span>
        </button>
      </div>
      <div id="mapa-comarca" ref={mapContainerRef}></div>
    </div>
  );
}
