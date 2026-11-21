import React, { useCallback, useMemo, useState } from "react";
import { useApp } from "../context/useApp.js";
import { municipiosMancomunidad, evaluarFiabilidadNegocio } from "../constants/comarca.js";
import { parseCoords } from "../api/mappers.js";
import { useNow } from "../hooks/useNow.js";
import { esEventoFinalizado, getDefaultEventDateRange } from "../utils/eventUtils.js";
import { comprimirImagenArchivo } from "../utils/imageCompressor.js";
import LocationPickerModal from "./modals/LocationPickerModal.jsx";
import BusinessStatsChart from "./publisher/BusinessStatsChart.jsx";
import {
  IconArrowLeft,
  IconCheck,
  IconClock,
  IconMapPin,
  IconPlus,
  IconStore,
  IconTrash,
  IconUsers,
} from "./Icons.jsx";

function UbicacionSelector({ pueblo, coords, onOpenModal, onClear }) {
  return (
    <div className="md:col-span-2 bg-white border-2 border-blue-200 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-bold text-stone-900">Ubicación exacta en el mapa</p>
        {coords ? (
          <p className="text-xs font-bold text-emerald-700 mt-0.5">
            Ubicación fijada: {coords[0].toFixed(5)}, {coords[1].toFixed(5)}
          </p>
        ) : (
          <p className="text-xs text-stone-600 mt-0.5">
            Si no añades una ubicación exacta, se usará el centro de {pueblo}.
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {coords && (
          <button
            type="button"
            onClick={onClear}
            className="bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold px-3 py-2 rounded-xl text-xs border border-stone-300"
          >
            Quitar
          </button>
        )}
        <button
          type="button"
          onClick={onOpenModal}
          className="inline-flex items-center gap-1.5 bg-blue-100 hover:bg-blue-200 text-blue-950 font-black px-3.5 py-2 rounded-xl text-xs border border-blue-300"
        >
          <IconMapPin className="w-4 h-4 text-blue-700 shrink-0" />
          <span>{coords ? "Cambiar ubicación" : "Añadir ubicación"}</span>
        </button>
      </div>
    </div>
  );
}

export default function PublisherPanel() {
  const {
    actividades,
    cuentasNegocio,
    cambiarRol,
    publicarEvento,
    crearNegocio,
    actualizarNegocio,
    eliminarNegocio,
    eliminarEvento,
    terminarEvento,
    setModalCambiarHora,
    setModalInscritos,
  } = useApp();

  const [mostrarFormEvento, setMostrarFormEvento] = useState(false);
  const [mostrarFormNegocio, setMostrarFormNegocio] = useState(false);
  const [negocioDetalleNombre, setNegocioDetalleNombre] = useState(null);

  // Form Evento state
  const [defaultDates] = useState(() => getDefaultEventDateRange());
  const [titulo, setTitulo] = useState("");
  const [categoria, setCategoria] = useState("Fiesta Patronal");
  const [negocioSelect, setNegocioSelect] = useState("");
  const [pueblo, setPueblo] = useState("Lucainena de las Torres");
  const [aforo, setAforo] = useState(40);
  const [dePago, setDePago] = useState(false);
  const [fechaInicio, setFechaInicio] = useState(defaultDates.fechaInicio);
  const [fechaFin, setFechaFin] = useState(defaultDates.fechaFin);
  const [descripcion, setDescripcion] = useState("");
  const [imagenBase64, setImagenBase64] = useState("");
  const [previewName, setPreviewName] = useState("");
  const [eventoCoords, setEventoCoords] = useState(null);
  const [enviandoEvento, setEnviandoEvento] = useState(false);
  const [enviandoNegocio, setEnviandoNegocio] = useState(false);

  const ahoraMs = useNow(60000);

  // Form Negocio state
  const [negNombre, setNegNombre] = useState("");
  const [negPueblo, setNegPueblo] = useState("Lucainena de las Torres");
  const [negInstagram, setNegInstagram] = useState("");
  const [negTwitter, setNegTwitter] = useState("");
  const [negFacebook, setNegFacebook] = useState("");
  const [negWeb, setNegWeb] = useState("");
  const [negCoords, setNegCoords] = useState(null);

  // Form Editar Negocio (pestaña de detalle)
  const [editNombre, setEditNombre] = useState("");
  const [editPueblo, setEditPueblo] = useState("Lucainena de las Torres");
  const [editInstagram, setEditInstagram] = useState("");
  const [editTwitter, setEditTwitter] = useState("");
  const [editFacebook, setEditFacebook] = useState("");
  const [editWeb, setEditWeb] = useState("");
  const [editCoords, setEditCoords] = useState(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  // Modal selector de ubicación en el mapa ('evento' | 'negocio' | 'editarNegocio')
  const [locationModal, setLocationModal] = useState({ open: false, target: null });

  const misNegocios = Object.keys(cuentasNegocio).filter((k) => cuentasNegocio[k].esMio);
  const misNegociosConfirmados = misNegocios.filter((k) => !cuentasNegocio[k].pendiente);

  const defaultBusiness =
    negocioSelect || (misNegociosConfirmados.length > 0 ? misNegociosConfirmados[0] : "");

  const negocioDetalle =
    negocioDetalleNombre && cuentasNegocio[negocioDetalleNombre]?.esMio
      ? cuentasNegocio[negocioDetalleNombre]
      : null;

  const abrirDetalleNegocio = (nombre) => {
    const info = cuentasNegocio[nombre];
    if (!info) return;
    setMostrarFormEvento(false);
    setMostrarFormNegocio(false);
    setNegocioDetalleNombre(nombre);
    setEditNombre(info.nombre || "");
    setEditPueblo(info.pueblo || "Lucainena de las Torres");
    setEditInstagram(info.instagramUrl || "");
    setEditTwitter(info.twitterUrl || "");
    setEditFacebook(info.facebookUrl || "");
    setEditWeb(info.webUrl || "");
    setEditCoords(
      info.coordenadas && info.coordenadas.includes(",")
        ? parseCoords(info.coordenadas, info.pueblo)
        : null
    );
  };

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await comprimirImagenArchivo(file, { maxSide: 1000, quality: 0.8 });
      setImagenBase64(compressed);
      setPreviewName(file.name);
    } catch {
      setPreviewName("");
    }
  };

  const handleCrearEvento = async (e) => {
    e.preventDefault();
    if (!defaultBusiness || enviandoEvento) return;
    if (new Date(fechaFin) <= new Date(fechaInicio)) {
      window.alert("La fecha y hora de fin debe ser posterior a la de inicio.");
      return;
    }
    setEnviandoEvento(true);
    try {
      await publicarEvento({
        titulo,
        categoria,
        negocio: defaultBusiness,
        pueblo,
        coordenadas: eventoCoords ? `${eventoCoords[0]}, ${eventoCoords[1]}` : undefined,
        aforo,
        dePago,
        fechaInicio,
        fechaFin,
        descripcion,
        imagen: imagenBase64,
      });

      setTitulo("");
      setDescripcion("");
      setImagenBase64("");
      setPreviewName("");
      setEventoCoords(null);
      setMostrarFormEvento(false);
    } finally {
      setEnviandoEvento(false);
    }
  };

  const handleCrearNegocio = async (e) => {
    e.preventDefault();
    if (!negNombre.trim() || enviandoNegocio) return;
    setEnviandoNegocio(true);
    try {
      await crearNegocio({
        nombre: negNombre.trim(),
        pueblo: negPueblo,
        coordenadas: negCoords ? `${negCoords[0]}, ${negCoords[1]}` : undefined,
        instagramUrl: negInstagram.trim(),
        twitterUrl: negTwitter.trim(),
        facebookUrl: negFacebook.trim(),
        webUrl: negWeb.trim(),
      });
      setNegNombre("");
      setNegInstagram("");
      setNegTwitter("");
      setNegFacebook("");
      setNegWeb("");
      setNegCoords(null);
      setMostrarFormNegocio(false);
    } finally {
      setEnviandoNegocio(false);
    }
  };

  const handleGuardarEdicionNegocio = async (e) => {
    e.preventDefault();
    if (!negocioDetalle || !editNombre.trim()) return;
    setGuardandoEdicion(true);
    try {
      const updated = await actualizarNegocio(negocioDetalle.nombre, {
        nombre: editNombre.trim(),
        pueblo: editPueblo,
        coordenadas: editCoords ? `${editCoords[0]}, ${editCoords[1]}` : undefined,
        instagramUrl: editInstagram.trim(),
        twitterUrl: editTwitter.trim(),
        facebookUrl: editFacebook.trim(),
        webUrl: editWeb.trim(),
      });
      if (updated) {
        setNegocioDetalleNombre(updated.nombre);
      }
    } finally {
      setGuardandoEdicion(false);
    }
  };

  const handleEliminarNegocio = async () => {
    if (!negocioDetalle) return;
    const confirmado = window.confirm(
      `¿Seguro que quieres borrar "${negocioDetalle.nombre}"? Esta acción no se puede deshacer.`
    );
    if (!confirmado) return;
    await eliminarNegocio(negocioDetalle.nombre);
    setNegocioDetalleNombre(null);
  };

  const pueblosArray = useMemo(() => Object.keys(municipiosMancomunidad).sort(), []);
  const eventosDelNegocio = useMemo(
    () => (negocioDetalle ? actividades.filter((a) => a.negocio === negocioDetalle.nombre) : []),
    [negocioDetalle, actividades]
  );

  const cerrarLocationModal = useCallback(() => {
    setLocationModal({ open: false, target: null });
  }, []);

  const confirmarLocationModal = useCallback((coords) => {
    setLocationModal((prev) => {
      if (prev.target === "evento") {
        setEventoCoords(coords);
      } else if (prev.target === "negocio") {
        setNegCoords(coords);
      } else if (prev.target === "editarNegocio") {
        setEditCoords(coords);
      }
      return prev;
    });
  }, []);

  return (
    <section id="panel-publicador" className="caja-panel bg-white p-4 sm:p-5 rounded-3xl shadow-sm space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-blue-200 pb-3">
        <div>
          <span className="bg-blue-100 text-blue-950 text-xs font-black px-3 py-1 rounded-full inline-block">
            Panel de Publicador · Sistema de Referencia
          </span>
          <h2 className="text-xl font-black mt-1.5">Mis Negocios y Eventos</h2>
          <p className="text-xs text-stone-600">
            Pulsa en cualquiera de tus negocios para ver sus detalles, editarlo, borrarlo o gestionar su historial de eventos.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setNegocioDetalleNombre(null);
              setMostrarFormNegocio(false);
              setMostrarFormEvento(!mostrarFormEvento);
            }}
            className="inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-black px-4 py-3 rounded-2xl text-sm"
          >
            <IconPlus className="w-4 h-4 shrink-0" />
            <span>Publicar Evento</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setNegocioDetalleNombre(null);
              setMostrarFormEvento(false);
              setMostrarFormNegocio(!mostrarFormNegocio);
            }}
            className="inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-3 rounded-2xl text-sm"
          >
            <IconStore className="w-4 h-4 shrink-0" />
            <span>Añadir Negocio / Redes</span>
          </button>
          <button
            type="button"
            onClick={() => cambiarRol("REGISTRADO")}
            className="bg-stone-200 hover:bg-stone-300 text-stone-900 font-bold px-4 py-3 rounded-2xl text-sm"
          >
            Volver a Vecino
          </button>
        </div>
      </div>

      {/* Pestañas de navegación rápida entre lista y detalle */}
      {negocioDetalle && (
        <div className="flex flex-wrap items-center gap-2 bg-blue-50 p-2 rounded-2xl border border-blue-200">
          <button
            type="button"
            onClick={() => setNegocioDetalleNombre(null)}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-blue-100 text-blue-950 font-bold px-3.5 py-2 rounded-xl text-sm border border-blue-200"
          >
            <IconArrowLeft className="w-4 h-4" />
            <span>Todos mis negocios</span>
          </button>
          <span className="bg-blue-700 text-white font-black px-3.5 py-2 rounded-xl text-sm">
            Detalle: {negocioDetalle.nombre}
          </span>
        </div>
      )}

      {/* Formulario Crear Evento */}
      {mostrarFormEvento && !negocioDetalle && (
        <form
          onSubmit={handleCrearEvento}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50/60 p-4 rounded-2xl border border-blue-200"
        >
          <div className="md:col-span-2">
            <label className="block text-sm font-bold mb-1">Nombre del evento *</label>
            <input
              type="text"
              required
              placeholder="Ej: Merienda y baile en la plaza"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full border-2 border-blue-300 rounded-xl p-2.5 sm:p-3 bg-white text-stone-900"
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Tipo de actividad *</label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full border-2 border-blue-300 rounded-xl p-2.5 sm:p-3 bg-white text-stone-900"
            >
              <option value="Fiesta Patronal">Fiesta Patronal</option>
              <option value="Deportes">Deportes</option>
              <option value="Gastronomía">Gastronomía</option>
              <option value="Turismo">Paseo / Turismo</option>
              <option value="Comercio">Comercio Local</option>
              <option value="Cultura">Cultura</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Negocio organizador *</label>
            <select
              value={defaultBusiness}
              onChange={(e) => setNegocioSelect(e.target.value)}
              required
              className="w-full border-2 border-blue-300 rounded-xl p-2.5 sm:p-3 bg-white text-stone-900"
            >
              {misNegociosConfirmados.length === 0 ? (
                <option value="">Ningún negocio confirmado aún</option>
              ) : (
                misNegociosConfirmados.map((nombre) => {
                  const evalRef = evaluarFiabilidadNegocio(nombre, cuentasNegocio);
                  return (
                    <option key={nombre} value={nombre}>
                      {nombre} ({evalRef.esDeConfianza ? `Ref. ${evalRef.nivel}/3 · Directo` : "Ref. 1/3 · Revisión"})
                    </option>
                  );
                })
              )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Pueblo *</label>
            <select
              value={pueblo}
              onChange={(e) => {
                setPueblo(e.target.value);
                setEventoCoords(null);
              }}
              className="w-full border-2 border-blue-300 rounded-xl p-2.5 sm:p-3 bg-white text-stone-900"
            >
              {pueblosArray.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-bold mb-1">Plazas *</label>
              <input
                type="number"
                min="1"
                required
                value={aforo}
                onChange={(e) => setAforo(Number(e.target.value))}
                className="w-full border-2 border-blue-300 rounded-xl p-2.5 sm:p-3 bg-white text-stone-900"
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Precio</label>
              <select
                value={dePago ? "true" : "false"}
                onChange={(e) => setDePago(e.target.value === "true")}
                className="w-full border-2 border-blue-300 rounded-xl p-2.5 sm:p-3 bg-white text-stone-900"
              >
                <option value="false">Gratis</option>
                <option value="true">De pago</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Fecha y hora inicio *</label>
            <input
              type="datetime-local"
              required
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full border-2 border-blue-300 rounded-xl p-2.5 sm:p-3 bg-white text-stone-900"
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Fecha y hora fin *</label>
            <input
              type="datetime-local"
              required
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full border-2 border-blue-300 rounded-xl p-2.5 sm:p-3 bg-white text-stone-900"
            />
          </div>

          <UbicacionSelector
            pueblo={pueblo}
            coords={eventoCoords}
            onOpenModal={() => setLocationModal({ open: true, target: "evento" })}
            onClear={() => setEventoCoords(null)}
          />

          <div className="md:col-span-2 bg-white text-stone-900 border-2 border-dashed border-blue-400 rounded-2xl p-4 space-y-2">
            <label className="block text-sm font-black">
              Foto o cartel del evento (si el negocio es Nivel 1 pasará por el Moderador) *
            </label>
            <input type="file" accept="image/*" onChange={handleImageChange} className="w-full text-sm" />
            {imagenBase64 && (
              <div className="flex items-center gap-3 pt-2">
                <img src={imagenBase64} alt="Vista previa" className="w-20 h-20 object-cover rounded-xl border" />
                <span className="text-xs font-bold text-stone-700 truncate">{previewName}</span>
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-bold mb-1">Explicación sencilla *</label>
            <textarea
              rows="2"
              required
              placeholder="Describe dónde es y qué se va a hacer."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full border-2 border-blue-300 rounded-xl p-2.5 sm:p-3 bg-white text-stone-900"
            ></textarea>
          </div>
          <div className="md:col-span-2 flex flex-col sm:flex-row gap-2 justify-end">
            <button
              type="button"
              onClick={() => setMostrarFormEvento(false)}
              className="bg-stone-200 text-stone-900 font-bold px-5 py-3 rounded-xl"
            >
              Cerrar
            </button>
            <button
              type="submit"
              className="bg-blue-700 hover:bg-blue-800 text-white font-black px-6 py-3 rounded-xl shadow"
            >
              Publicar Evento
            </button>
          </div>
        </form>
      )}

      {/* Formulario Añadir Negocio */}
      {mostrarFormNegocio && !negocioDetalle && (
        <form
          onSubmit={handleCrearNegocio}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-emerald-50/60 p-4 rounded-2xl border border-emerald-300"
        >
          <div>
            <label className="block text-sm font-bold mb-1">Nombre del negocio *</label>
            <input
              type="text"
              required
              placeholder="Ej: Bar La Plaza"
              value={negNombre}
              onChange={(e) => setNegNombre(e.target.value)}
              className="w-full border-2 border-blue-300 rounded-xl p-2.5 sm:p-3 bg-white text-stone-900"
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Pueblo *</label>
            <select
              required
              value={negPueblo}
              onChange={(e) => {
                setNegPueblo(e.target.value);
                setNegCoords(null);
              }}
              className="w-full border-2 border-blue-300 rounded-xl p-2.5 sm:p-3 bg-white text-stone-900"
            >
              {pueblosArray.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Instagram (opcional)</label>
            <input
              type="url"
              placeholder="https://instagram.com/..."
              value={negInstagram}
              onChange={(e) => setNegInstagram(e.target.value)}
              className="w-full border-2 border-blue-300 rounded-xl p-2.5 sm:p-3 bg-white text-stone-900"
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Twitter / X (opcional)</label>
            <input
              type="url"
              placeholder="https://x.com/..."
              value={negTwitter}
              onChange={(e) => setNegTwitter(e.target.value)}
              className="w-full border-2 border-blue-300 rounded-xl p-2.5 sm:p-3 bg-white text-stone-900"
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Facebook (opcional)</label>
            <input
              type="url"
              placeholder="https://facebook.com/..."
              value={negFacebook}
              onChange={(e) => setNegFacebook(e.target.value)}
              className="w-full border-2 border-blue-300 rounded-xl p-2.5 sm:p-3 bg-white text-stone-900"
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Web (opcional)</label>
            <input
              type="url"
              placeholder="https://..."
              value={negWeb}
              onChange={(e) => setNegWeb(e.target.value)}
              className="w-full border-2 border-blue-300 rounded-xl p-2.5 sm:p-3 bg-white text-stone-900"
            />
          </div>
          <UbicacionSelector
            pueblo={negPueblo}
            coords={negCoords}
            onOpenModal={() => setLocationModal({ open: true, target: "negocio" })}
            onClear={() => setNegCoords(null)}
          />
          <div className="md:col-span-2 flex flex-col sm:flex-row gap-2 justify-end">
            <button
              type="button"
              onClick={() => setMostrarFormNegocio(false)}
              className="bg-stone-200 text-stone-900 font-bold px-5 py-3 rounded-xl"
            >
              Cerrar
            </button>
            <button
              type="submit"
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-black px-6 py-3 rounded-xl shadow"
            >
              Enviar para Confirmación
            </button>
          </div>
        </form>
      )}

      {/* Pestaña de Detalle, Edición, Borrado e Historial del Negocio */}
      {negocioDetalle ? (
        <div className="space-y-6">
          <form
            onSubmit={handleGuardarEdicionNegocio}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50/60 p-4 rounded-2xl border border-blue-200"
          >
            <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2 border-b border-blue-200 pb-2">
              <h3 className="font-black text-lg">Detalles del negocio</h3>
              <span
                className={`text-xs font-black px-3 py-1 rounded-full ${
                  negocioDetalle.pendienteSync
                    ? "bg-amber-400 text-stone-950"
                    : negocioDetalle.pendiente
                      ? "bg-amber-200 text-amber-950"
                      : "bg-emerald-100 text-emerald-900"
                }`}
              >
                {negocioDetalle.pendienteSync
                  ? "⏳ Guardado offline · Pendiente de sincronizar"
                  : negocioDetalle.pendiente
                    ? "Pendiente de confirmación"
                    : `Confirmado · Fiabilidad ${negocioDetalle.fiabilidad}`}
              </span>
            </div>

            <div>
              <label className="block text-sm font-bold mb-1">Nombre del negocio *</label>
              <input
                type="text"
                required
                value={editNombre}
                onChange={(e) => setEditNombre(e.target.value)}
                className="w-full border-2 border-blue-300 rounded-xl p-2.5 sm:p-3 bg-white text-stone-900"
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-1">Pueblo *</label>
              <select
                required
                value={editPueblo}
                onChange={(e) => {
                  setEditPueblo(e.target.value);
                  setEditCoords(null);
                }}
                className="w-full border-2 border-blue-300 rounded-xl p-2.5 sm:p-3 bg-white text-stone-900"
              >
                {pueblosArray.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold mb-1">Instagram</label>
              <input
                type="url"
                placeholder="https://instagram.com/..."
                value={editInstagram}
                onChange={(e) => setEditInstagram(e.target.value)}
                className="w-full border-2 border-blue-300 rounded-xl p-2.5 sm:p-3 bg-white text-stone-900"
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-1">Twitter / X</label>
              <input
                type="url"
                placeholder="https://x.com/..."
                value={editTwitter}
                onChange={(e) => setEditTwitter(e.target.value)}
                className="w-full border-2 border-blue-300 rounded-xl p-2.5 sm:p-3 bg-white text-stone-900"
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-1">Facebook</label>
              <input
                type="url"
                placeholder="https://facebook.com/..."
                value={editFacebook}
                onChange={(e) => setEditFacebook(e.target.value)}
                className="w-full border-2 border-blue-300 rounded-xl p-2.5 sm:p-3 bg-white text-stone-900"
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-1">Web</label>
              <input
                type="url"
                placeholder="https://..."
                value={editWeb}
                onChange={(e) => setEditWeb(e.target.value)}
                className="w-full border-2 border-blue-300 rounded-xl p-2.5 sm:p-3 bg-white text-stone-900"
              />
            </div>

            <UbicacionSelector
              pueblo={editPueblo}
              coords={editCoords}
              onOpenModal={() => setLocationModal({ open: true, target: "editarNegocio" })}
              onClear={() => setEditCoords(null)}
            />

            <div className="md:col-span-2 flex flex-col sm:flex-row gap-2 justify-between pt-2">
              <button
                type="button"
                onClick={handleEliminarNegocio}
                className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-black px-5 py-3 rounded-xl text-sm"
              >
                <IconTrash className="w-4 h-4" />
                <span>Eliminar negocio</span>
              </button>
              <button
                type="submit"
                disabled={guardandoEdicion}
                className="inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-black px-6 py-3 rounded-xl shadow text-sm"
              >
                <IconCheck className="w-4 h-4" />
                <span>{guardandoEdicion ? "Guardando..." : "Guardar cambios"}</span>
              </button>
            </div>
          </form>

          {/* Estadísticas de inscripciones por categoría */}
          <BusinessStatsChart eventos={eventosDelNegocio} />

          {/* Historial de eventos del negocio */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-black text-lg">Historial de eventos ({eventosDelNegocio.length})</h3>
            </div>

            {eventosDelNegocio.length === 0 ? (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-sm text-stone-600 text-center">
                Este negocio todavía no tiene eventos publicados.
              </div>
            ) : (
              <div className="space-y-3">
                {eventosDelNegocio.map((act) => (
                  <div
                    key={act.id}
                    className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-base text-stone-900">{act.nombre}</p>
                        <span
                          className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                            act.pendienteSync
                              ? "bg-amber-400 text-stone-950"
                              : act.estadoModeracion === "aprobada"
                                ? "bg-emerald-100 text-emerald-900"
                                : act.estadoModeracion === "denegada"
                                  ? "bg-red-100 text-red-900"
                                  : "bg-amber-200 text-amber-950"
                          }`}
                        >
                          {act.pendienteSync ? "⏳ En cola offline" : act.estadoModeracion}
                        </span>
                      </div>
                      <p className="text-xs text-stone-600 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1">
                          <IconMapPin className="w-3.5 h-3.5" />
                          <span>{act.pueblo}</span>
                        </span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <IconClock className="w-3.5 h-3.5" />
                          <span>{act.fecha}</span>
                        </span>
                        <span>·</span>
                        <span>
                          Plazas: {act.asistentes}/{act.aforo}
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 shrink-0">
                      {act.estadoModeracion !== "denegada" && (
                        <>
                          {!esEventoFinalizado(act, ahoraMs) ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`¿Marcar "${act.nombre}" como finalizado?`)) {
                                  terminarEvento(act.id);
                                }
                              }}
                              className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-2 rounded-xl text-xs"
                            >
                              <IconCheck className="w-4 h-4" />
                              <span>Terminar</span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-900 font-black px-3 py-2 rounded-xl text-xs">
                              <IconCheck className="w-3.5 h-3.5" />
                              <span>Finalizado</span>
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setModalCambiarHora({ open: true, actividad: act })}
                            className="inline-flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold px-3 py-2 rounded-xl text-xs"
                          >
                            <IconClock className="w-4 h-4" />
                            <span>Editar hora</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setModalInscritos({ open: true, actividad: act })}
                            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-bold px-3 py-2 rounded-xl text-xs"
                          >
                            <IconUsers className="w-4 h-4" />
                            <span>Apuntados ({act.asistentes})</span>
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`¿Eliminar permanentemente "${act.nombre}"?`)) {
                            eliminarEvento(act.id);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-2 rounded-xl text-xs"
                      >
                        <IconTrash className="w-4 h-4" />
                        <span>Borrar</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Lista de mis negocios clicables */
        <div id="lista-cuentas-ia" className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {misNegocios.length === 0 ? (
            <div className="col-span-full p-4 bg-blue-50 border border-blue-200 rounded-2xl text-center text-stone-600">
              Aún no tienes negocios registrados. Pulsa &quot;Añadir Negocio / Redes&quot; para crear el primero.
            </div>
          ) : (
            misNegocios.map((nombre) => {
              const info = cuentasNegocio[nombre];
              const evalRef = evaluarFiabilidadNegocio(nombre, cuentasNegocio);
              const badgeColor = info.pendienteSync
                ? "bg-amber-400 text-stone-950"
                : info.pendiente
                  ? "bg-amber-200 text-amber-950"
                  : evalRef.esDeConfianza
                    ? "bg-emerald-100 text-emerald-900"
                    : "bg-blue-100 text-blue-950";

              return (
                <button
                  key={nombre}
                  type="button"
                  onClick={() => abrirDetalleNegocio(nombre)}
                  className="text-left p-3.5 bg-blue-50/70 hover:bg-blue-100/80 rounded-2xl border-2 border-blue-200 hover:border-blue-500 flex justify-between items-center gap-2 transition"
                >
                  <div className="min-w-0">
                    <p className="font-black truncate text-blue-950">{nombre}</p>
                    <p className="text-xs text-stone-600 inline-flex items-center gap-1 flex-wrap mt-0.5">
                      <IconMapPin className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {info.pueblo} ·{" "}
                        {info.pendienteSync
                          ? "Guardado sin conexión · Se enviará al reconectar"
                          : info.pendiente
                            ? "Pendiente de confirmación"
                            : evalRef.motivo}
                      </span>
                    </p>
                    <p className="text-[11px] font-bold text-blue-700 mt-1">
                      Pulsa para editar, borrar o ver eventos
                    </p>
                  </div>
                  <span className={`${badgeColor} text-xs font-black px-2.5 py-1 rounded-lg shrink-0`}>
                    {info.pendienteSync
                      ? "⏳ Sin red"
                      : info.pendiente
                        ? "Pendiente"
                        : `Ref. ${evalRef.nivel}/3`}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}

      <LocationPickerModal
        isOpen={locationModal.open}
        onClose={cerrarLocationModal}
        pueblo={
          locationModal.target === "evento"
            ? pueblo
            : locationModal.target === "negocio"
              ? negPueblo
              : editPueblo
        }
        initialCoords={
          locationModal.target === "evento"
            ? eventoCoords
            : locationModal.target === "negocio"
              ? negCoords
              : editCoords
        }
        onConfirm={confirmarLocationModal}
      />
    </section>
  );
}
