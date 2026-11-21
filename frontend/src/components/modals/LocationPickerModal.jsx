import React, { useEffect, useRef, useState, useCallback } from "react";
import { CENTRO_MANCOMUNIDAD, municipiosMancomunidad } from "../../constants/comarca.js";
import { IconCheck, IconClose, IconMapPin, IconTarget } from "../Icons.jsx";

export default function LocationPickerModal({
  isOpen,
  onClose,
  pueblo,
  initialCoords = null,
  onConfirm,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  const [selectedCoords, setSelectedCoords] = useState(initialCoords);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");

  const getInitialCenter = useCallback(() => {
    if (
      Array.isArray(initialCoords) &&
      initialCoords.length === 2 &&
      !Number.isNaN(initialCoords[0]) &&
      !Number.isNaN(initialCoords[1])
    ) {
      return initialCoords;
    }
    return municipiosMancomunidad[pueblo] || CENTRO_MANCOMUNIDAD;
  }, [initialCoords, pueblo]);

  const placeMarker = useCallback((lat, lng, shouldPan = false) => {
    const map = mapInstanceRef.current;
    const L = window.L;
    if (!map || !L) return;

    const coords = [Number(lat.toFixed(6)), Number(lng.toFixed(6))];
    setSelectedCoords(coords);
    setGeoError("");

    if (markerRef.current) {
      markerRef.current.setLatLng(coords);
    } else {
      const marker = L.marker(coords, { draggable: true }).addTo(map);
      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        setSelectedCoords([Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6))]);
      });
      markerRef.current = marker;
    }

    if (shouldPan) {
      map.setView(coords, Math.max(map.getZoom(), 16));
    }
  }, []);

  // Sincronizar estado inicial al abrir
  useEffect(() => {
    if (isOpen) {
      setSelectedCoords(initialCoords);
      setGeoError("");
      setLocating(false);
    }
  }, [isOpen, initialCoords]);

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Inicializar mapa Leaflet cuando el modal está abierto
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;
    if (typeof window.L === "undefined") {
      setGeoError("El mapa no está disponible en este momento.");
      return;
    }

    const L = window.L;
    const container = mapContainerRef.current;
    if (container._leaflet_id) {
      delete container._leaflet_id;
    }

    const center = getInitialCenter();
    const initialZoom = initialCoords ? 16 : 15;

    const map = L.map(container, {
      center,
      zoom: initialZoom,
      minZoom: 9,
      maxZoom: 19,
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    mapInstanceRef.current = map;
    markerRef.current = null;

    if (
      Array.isArray(initialCoords) &&
      initialCoords.length === 2 &&
      !Number.isNaN(initialCoords[0]) &&
      !Number.isNaN(initialCoords[1])
    ) {
      placeMarker(initialCoords[0], initialCoords[1], false);
    }

    map.on("click", (e) => {
      placeMarker(e.latlng.lat, e.latlng.lng, false);
    });

    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      markerRef.current = null;
    };
  }, [isOpen, getInitialCenter, initialCoords, placeMarker]);

  if (!isOpen) return null;

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoError("Tu navegador no soporta geolocalización.");
      return;
    }

    setLocating(true);
    setGeoError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const { latitude, longitude } = position.coords;
        placeMarker(latitude, longitude, true);
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError("Permiso de ubicación denegado. Actívalo en tu navegador o pincha en el mapa.");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGeoError("No se pudo obtener tu ubicación actual. Pincha directamente en el mapa.");
        } else if (err.code === err.TIMEOUT) {
          setGeoError("Se agotó el tiempo buscando tu ubicación. Inténtalo de nuevo o pincha en el mapa.");
        } else {
          setGeoError("Error al obtener la ubicación actual.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleConfirm = () => {
    if (!selectedCoords) return;
    onConfirm(selectedCoords);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white text-stone-900 rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border-2 border-blue-700"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Seleccionar ubicación exacta"
      >
        <div className="shrink-0 flex justify-between items-center px-5 py-3.5 border-b border-blue-100 bg-white">
          <div className="min-w-0">
            <h3 className="font-black text-lg sm:text-xl inline-flex items-center gap-2">
              <IconMapPin className="w-5 h-5 text-blue-700 shrink-0" />
              <span>Seleccionar ubicación exacta</span>
            </h3>
            <p className="text-xs text-stone-600 truncate">
              Centrado en <span className="font-bold text-blue-950">{pueblo}</span> · Pincha en el mapa para colocar el marcador
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="btn-cerrar-modal w-11 h-11 rounded-full bg-blue-100 text-blue-950 hover:bg-blue-200 flex items-center justify-center shrink-0"
          >
            <IconClose className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-3">
          <div
            ref={mapContainerRef}
            className="w-full h-72 sm:h-80 rounded-2xl border-2 border-blue-300 overflow-hidden bg-stone-100 z-0"
          />

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-blue-50 border border-blue-200 rounded-2xl px-3.5 py-2.5">
            {selectedCoords ? (
              <span className="font-bold text-blue-950">
                Ubicación marcada: {selectedCoords[0].toFixed(5)}, {selectedCoords[1].toFixed(5)}
              </span>
            ) : (
              <span className="text-stone-600 font-medium">
                Toca cualquier punto del mapa o usa tu ubicación actual.
              </span>
            )}
            <span className="text-stone-500">Puedes arrastrar el pin para ajustar</span>
          </div>

          {geoError && (
            <div className="text-xs font-bold text-red-800 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
              {geoError}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={locating}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-stone-100 hover:bg-stone-200 disabled:opacity-60 text-stone-900 font-bold py-3 px-4 rounded-2xl border border-stone-300 text-sm"
            >
              <IconTarget className="w-4 h-4 text-blue-700 shrink-0" />
              <span>{locating ? "Buscando ubicación..." : "Usar mi ubicación actual"}</span>
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selectedCoords}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-3 px-4 rounded-2xl shadow text-sm"
            >
              <IconCheck className="w-5 h-5 shrink-0" />
              <span>Confirmar ubicación</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

