import React, { useEffect, useRef, useState, useCallback } from "react";
import { CENTRO_MANCOMUNIDAD, municipiosMancomunidad } from "../../constants/comarca.js";
import { IconCheck, IconMapPin, IconTarget } from "../Icons.jsx";
import BaseModal from "./BaseModal.jsx";

function LocationPickerContent({ pueblo, initialCoords, onClose, onConfirm }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const mountedRef = useRef(true);

  const [selectedCoords, setSelectedCoords] = useState(initialCoords);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState(() =>
    typeof window !== "undefined" && typeof window.L === "undefined"
      ? "El mapa no está disponible en este momento."
      : ""
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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

  useEffect(() => {
    if (!mapContainerRef.current || typeof window.L === "undefined") return;

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
      const marker = L.marker(initialCoords, { draggable: true }).addTo(map);
      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        setSelectedCoords([Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6))]);
      });
      markerRef.current = marker;
    }

    map.on("click", (e) => {
      placeMarker(e.latlng.lat, e.latlng.lng, false);
    });

    const timer = window.setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 150);

    return () => {
      window.clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      markerRef.current = null;
    };
  }, [getInitialCenter, initialCoords, placeMarker]);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoError("Tu navegador no soporta geolocalización.");
      return;
    }

    setLocating(true);
    setGeoError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!mountedRef.current) return;
        setLocating(false);
        const { latitude, longitude } = position.coords;
        placeMarker(latitude, longitude, true);
      },
      (err) => {
        if (!mountedRef.current) return;
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
    <div className="space-y-3">
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
        <div role="alert" className="text-xs font-bold text-red-800 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
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
  );
}

export default function LocationPickerModal({
  isOpen,
  onClose,
  pueblo,
  initialCoords = null,
  onConfirm,
}) {
  return (
    <BaseModal
      open={isOpen}
      onClose={onClose}
      title="Seleccionar ubicación exacta"
      subtitle={`Centrado en ${pueblo} · Pincha en el mapa para colocar el marcador`}
      icon={<IconMapPin className="w-5 h-5 text-blue-700 shrink-0" />}
      maxWidthClass="max-w-2xl"
      containerClassName="bg-white text-stone-900 rounded-3xl w-full max-h-[92vh] overflow-y-auto p-5 shadow-2xl border-2 border-blue-700 space-y-4"
    >
      {isOpen && (
        <LocationPickerContent
          key={`${pueblo}-${initialCoords ? initialCoords.join(",") : "none"}`}
          pueblo={pueblo}
          initialCoords={initialCoords}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      )}
    </BaseModal>
  );
}
