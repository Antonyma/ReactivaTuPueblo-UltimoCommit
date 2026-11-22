import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useApp } from "../../context/useApp.js";
import { eventosApi } from "../../api/client.js";
import { useNow } from "../../hooks/useNow.js";
import { esEventoFinalizado } from "../../utils/eventUtils.js";
import { comprimirImagenArchivo } from "../../utils/imageCompressor.js";
import { IconClose, IconPlus, IconStar, IconTrash } from "../Icons.jsx";
import BaseModal from "./BaseModal.jsx";

export default function ReviewsModal() {
  const {
    modalResenas,
    setModalResenas,
    cuentasNegocio,
    resenasPorEvento,
    actividades,
    misInscripcionesIds,
    misValoracionesEventoIds,
    usuario,
    isOnline,
    mostrarToast,
    agregarResena,
    cargarResenasEvento,
    cargarResenasNegocio,
  } = useApp();

  const [tab, setTab] = useState("opiniones");
  const [estrellas, setEstrellas] = useState(5);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  const [imagenesEvento, setImagenesEvento] = useState([]);
  const [cargandoImagenes, setCargandoImagenes] = useState(false);
  const [fotosSeleccionadas, setFotosSeleccionadas] = useState([]);
  const [subiendoFotos, setSubiendoFotos] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState(null);

  const ahoraMs = useNow(60000);
  const nombreNegocio = modalResenas.nombreNegocio;
  const eventoIdObjetivo = modalResenas.eventoId ?? null;

  const cerrarModal = useCallback(() => {
    setFotoAmpliada(null);
    setFotosSeleccionadas([]);
    setTab("opiniones");
    setModalResenas({ open: false, nombreNegocio: null, eventoId: null });
  }, [setModalResenas]);

  useEffect(() => {
    if (!modalResenas.open) return;
    let activo = true;
    if (eventoIdObjetivo != null) {
      cargarResenasEvento(eventoIdObjetivo);
      if (isOnline && !String(eventoIdObjetivo).startsWith("temp_")) {
        Promise.resolve().then(async () => {
          if (activo) setCargandoImagenes(true);
          try {
            const res = await eventosApi.listarImagenes(eventoIdObjetivo);
            if (activo) setImagenesEvento(res?.data?.imagenes || []);
          } catch {
            if (activo) setImagenesEvento([]);
          } finally {
            if (activo) setCargandoImagenes(false);
          }
        });
      }
    } else if (nombreNegocio) {
      cargarResenasNegocio(nombreNegocio);
    }
    return () => {
      activo = false;
    };
  }, [
    modalResenas.open,
    eventoIdObjetivo,
    nombreNegocio,
    isOnline,
    cargarResenasEvento,
    cargarResenasNegocio,
  ]);

  const eventoActual = useMemo(
    () =>
      eventoIdObjetivo != null
        ? actividades.find((a) => Number(a.id) === Number(eventoIdObjetivo)) || null
        : null,
    [actividades, eventoIdObjetivo]
  );

  const resenas = useMemo(
    () =>
      eventoIdObjetivo != null
        ? resenasPorEvento[eventoIdObjetivo] || []
        : cuentasNegocio[nombreNegocio]?.resenas || [],
    [eventoIdObjetivo, resenasPorEvento, cuentasNegocio, nombreNegocio]
  );

  const totalResenas = resenas.length;
  const mediaResenas =
    totalResenas > 0
      ? Number(
          (resenas.reduce((acc, r) => acc + Number(r.estrellas || 0), 0) / totalResenas).toFixed(1)
        )
      : eventoActual?.mediaEstrellas ?? null;

  const { eventosAsistidos, eventosFinalizados, eventoParaResenar } = useMemo(() => {
    const asistidos = actividades.filter(
      (a) => a.negocio === nombreNegocio && misInscripcionesIds.includes(a.id)
    );
    const finalizados = asistidos.filter((a) => esEventoFinalizado(a, ahoraMs));
    const pendientes = finalizados.filter((a) => !misValoracionesEventoIds.includes(a.id));
    const objetivo = usuario
      ? eventoIdObjetivo != null
        ? pendientes.find((a) => Number(a.id) === Number(eventoIdObjetivo)) || null
        : pendientes[0] || null
      : null;
    return {
      eventosAsistidos: asistidos,
      eventosFinalizados: finalizados,
      eventoParaResenar: objetivo,
    };
  }, [
    actividades,
    nombreNegocio,
    misInscripcionesIds,
    ahoraMs,
    misValoracionesEventoIds,
    usuario,
    eventoIdObjetivo,
  ]);

  const puedeSubirFotos = useMemo(() => {
    if (!usuario || !eventoActual || !esEventoFinalizado(eventoActual, ahoraMs)) return false;
    const esPropietario = Boolean(cuentasNegocio[eventoActual.negocio]?.esMio);
    const asistio = misInscripcionesIds.includes(eventoActual.id);
    return esPropietario || asistio;
  }, [usuario, eventoActual, ahoraMs, cuentasNegocio, misInscripcionesIds]);

  const yaValoroEste =
    Boolean(usuario) &&
    !eventoParaResenar &&
    (eventoIdObjetivo != null
      ? misValoracionesEventoIds.includes(Number(eventoIdObjetivo))
      : eventosFinalizados.length > 0);

  const handleSeleccionarFotos = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;

    const disponibles = Math.max(0, 10 - fotosSeleccionadas.length);
    const lote = files.slice(0, disponibles);
    if (files.length > disponibles) {
      mostrarToast("Máximo 10 imágenes por lote.");
    }

    try {
      const comprimidas = await Promise.all(
        lote.map(async (file) => ({
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          dataUrl: await comprimirImagenArchivo(file, { maxSide: 1000, quality: 0.78 }),
        }))
      );
      setFotosSeleccionadas((prev) => [...prev, ...comprimidas]);
    } catch {
      mostrarToast("Alguna imagen no pudo procesarse.");
    }
  };

  const quitarFotoSeleccionada = (id) => {
    setFotosSeleccionadas((prev) => prev.filter((f) => f.id !== id));
  };

  const subirLoteFotos = async (evId) => {
    if (!evId || fotosSeleccionadas.length === 0) return true;
    if (!isOnline) {
      mostrarToast("Necesitas conexión a internet para subir fotos del evento.");
      return false;
    }
    setSubiendoFotos(true);
    try {
      const res = await eventosApi.subirImagenes(
        evId,
        fotosSeleccionadas.map((f) => f.dataUrl)
      );
      const nuevas = Array.isArray(res?.data) ? res.data : res?.data ? [res.data] : [];
      setImagenesEvento((prev) => [...nuevas, ...prev]);
      setFotosSeleccionadas([]);
      mostrarToast(res?.message || "Imágenes subidas correctamente.");
      return true;
    } catch (err) {
      mostrarToast(`Error al subir imágenes: ${err.message}`);
      return false;
    } finally {
      setSubiendoFotos(false);
    }
  };

  const handleEliminarFoto = async (imagenId) => {
    if (!eventoActual) return;
    if (!window.confirm("¿Eliminar esta foto de la galería del evento?")) return;
    try {
      await eventosApi.eliminarImagen(eventoActual.id, imagenId);
      setImagenesEvento((prev) => prev.filter((img) => Number(img.id) !== Number(imagenId)));
      mostrarToast("Foto eliminada.");
    } catch (err) {
      mostrarToast(`No se pudo eliminar la foto: ${err.message}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!texto.trim() || !eventoParaResenar || enviando) return;
    setEnviando(true);
    try {
      const ok = await agregarResena(nombreNegocio, estrellas, texto.trim(), eventoParaResenar.id);
      if (ok !== false) {
        setTexto("");
        if (fotosSeleccionadas.length > 0) {
          await subirLoteFotos(eventoParaResenar.id);
        }
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <BaseModal
      open={Boolean(modalResenas.open && nombreNegocio)}
      onClose={cerrarModal}
      title={eventoActual ? eventoActual.nombre : `Opiniones: ${nombreNegocio || ""}`}
      subtitle={eventoActual ? nombreNegocio : null}
      maxWidthClass="max-w-lg"
      containerClassName="bg-white text-stone-900 rounded w-full max-h-[90vh] overflow-y-auto p-5 shadow-2xl border border-[#16324F] border-t-4 border-t-[#3D5A3C] space-y-3"
    >
      <div className="flex items-center justify-between gap-2 bg-[#F4F3EF] border border-[#D6D3CD] rounded px-3.5 py-2">
        <div className="inline-flex items-center gap-1.5">
          <IconStar className="w-5 h-5 text-amber-600" filled />
          <span className="font-bold text-base text-[#16324F]">
            {mediaResenas !== null ? `${Number(mediaResenas).toFixed(1)} / 5` : "Sin nota aún"}
          </span>
        </div>
        <span className="text-xs font-bold text-stone-600">
          {totalResenas === 1 ? "1 reseña" : `${totalResenas} reseñas`}
          {eventoActual ? ` · ${imagenesEvento.length} fotos` : ""}
        </span>
      </div>

      {eventoActual && (
        <div role="tablist" className="flex items-center gap-4 border-b border-[#D6D3CD]">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "opiniones"}
            onClick={() => setTab("opiniones")}
            className={`pb-2 text-xs sm:text-sm font-bold border-b-2 transition ${
              tab === "opiniones"
                ? "border-[#3D5A3C] text-[#16324F]"
                : "border-transparent text-stone-500 hover:text-[#16324F]"
            }`}
          >
            Opiniones ({totalResenas})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "fotos"}
            onClick={() => setTab("fotos")}
            className={`pb-2 text-xs sm:text-sm font-bold border-b-2 transition ${
              tab === "fotos"
                ? "border-[#3D5A3C] text-[#16324F]"
                : "border-transparent text-stone-500 hover:text-[#16324F]"
            }`}
          >
            Galería de fotos ({imagenesEvento.length})
          </button>
        </div>
      )}

      {tab === "opiniones" ? (
        <>
          <div className="max-h-48 overflow-y-auto divide-y divide-[#EFECE6] text-sm border border-[#D6D3CD] rounded px-3 bg-[#FAF9F6]">
            {resenas.length === 0 ? (
              <p className="text-stone-500 text-center py-4 text-xs">
                Sin opiniones todavía para esta actividad.
              </p>
            ) : (
              resenas.map((r, i) => (
                <div key={r.id || i} className="py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[#16324F]">
                      {r.usuario}
                      {r.pendienteSync && (
                        <span className="ml-1.5 text-[10px] font-bold bg-amber-200 text-amber-950 px-2 py-0.5 rounded-sm">
                          Pendiente de red
                        </span>
                      )}
                    </span>
                    <span
                      className="inline-flex items-center gap-0.5 text-amber-600"
                      aria-label={`${r.estrellas} de 5 estrellas`}
                    >
                      {Array.from({ length: r.estrellas }).map((_, idx) => (
                        <IconStar key={idx} className="w-4 h-4" filled />
                      ))}
                    </span>
                  </div>
                  <p className="text-xs text-stone-700 mt-1">{r.texto}</p>
                </div>
              ))
            )}
          </div>

          {eventoParaResenar ? (
            <form onSubmit={handleSubmit} className="space-y-2.5">
              <div>
                <label htmlFor="resena-estrellas" className="sr-only">
                  Puntuación en estrellas
                </label>
                <select
                  id="resena-estrellas"
                  value={estrellas}
                  onChange={(e) => setEstrellas(Number(e.target.value))}
                  className="w-full border border-[#C9C4BA] focus:border-[#16324F] outline-none rounded p-2.5 font-bold bg-white text-sm"
                >
                  <option value="5">5 estrellas - Excelente</option>
                  <option value="4">4 estrellas - Muy bien</option>
                  <option value="3">3 estrellas - Normal</option>
                  <option value="2">2 estrellas - Regular</option>
                  <option value="1">1 estrella - Mal</option>
                </select>
              </div>

              <div>
                <label htmlFor="resena-texto" className="sr-only">
                  Tu opinión
                </label>
                <input
                  id="resena-texto"
                  type="text"
                  required
                  placeholder="Escribe tu opinión aquí..."
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  className="w-full border border-[#C9C4BA] focus:border-[#16324F] outline-none rounded p-2.5 text-sm"
                />
              </div>

              {puedeSubirFotos && (
                <div className="border border-dashed border-[#9BB094] bg-[#F6F8F4] rounded p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#2F5233]">
                      Añadir fotos del evento (opcional, máx. 10)
                    </span>
                    <label className="cursor-pointer inline-flex items-center gap-1 bg-[#3D5A3C] hover:bg-[#2F472E] text-white text-xs font-bold px-2.5 py-1 rounded">
                      <IconPlus className="w-3.5 h-3.5" />
                      <span>Elegir fotos</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleSeleccionarFotos}
                        className="sr-only"
                      />
                    </label>
                  </div>

                  {fotosSeleccionadas.length > 0 && (
                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                      {fotosSeleccionadas.map((f) => (
                        <div key={f.id} className="relative group">
                          <img
                            src={f.dataUrl}
                            alt={f.name}
                            className="w-full h-14 object-cover rounded border border-[#D6D3CD]"
                          />
                          <button
                            type="button"
                            onClick={() => quitarFotoSeleccionada(f.id)}
                            aria-label="Quitar foto"
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#7F1D1D] text-white flex items-center justify-center"
                          >
                            <IconClose className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={enviando || subiendoFotos}
                className="w-full bg-[#C85A17] hover:bg-[#AD4B10] disabled:opacity-60 text-white font-bold py-2.5 rounded"
              >
                {enviando || subiendoFotos
                  ? "Enviando..."
                  : fotosSeleccionadas.length > 0
                    ? `Enviar Opinión y ${fotosSeleccionadas.length} foto(s)`
                    : "Enviar Opinión"}
              </button>
            </form>
          ) : (
            <p className="text-xs sm:text-sm text-[#16324F] bg-[#F4F3EF] border-l-4 border-[#3D5A3C] p-3 rounded-sm font-semibold">
              {yaValoroEste
                ? "Ya has enviado tu opinión para esta actividad. Puedes seguir viendo o subiendo fotos en la pestaña Galería."
                : eventosAsistidos.length > 0
                  ? "Podrás dejar tu reseña y fotos cuando haya acabado el evento al que te apuntaste."
                  : "Solo puedes reseñar si te has apuntado a esta actividad y ya ha acabado."}
            </p>
          )}
        </>
      ) : (
        <div className="space-y-3">
          {puedeSubirFotos && (
            <div className="border border-dashed border-[#9BB094] bg-[#F6F8F4] rounded p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-[#2F5233]">
                  Sube una batería de fotos del evento (máx. 10)
                </p>
                <label className="cursor-pointer inline-flex items-center gap-1 bg-[#3D5A3C] hover:bg-[#2F472E] text-white text-xs font-bold px-3 py-1.5 rounded">
                  <IconPlus className="w-3.5 h-3.5" />
                  <span>Seleccionar fotos</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleSeleccionarFotos}
                    className="sr-only"
                  />
                </label>
              </div>

              {fotosSeleccionadas.length > 0 && (
                <div className="space-y-2">
                  <div className="grid grid-cols-4 gap-1.5">
                    {fotosSeleccionadas.map((f) => (
                      <div key={f.id} className="relative">
                        <img
                          src={f.dataUrl}
                          alt={f.name}
                          className="w-full h-14 object-cover rounded border border-[#D6D3CD]"
                        />
                        <button
                          type="button"
                          onClick={() => quitarFotoSeleccionada(f.id)}
                          aria-label="Quitar foto"
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#7F1D1D] text-white flex items-center justify-center"
                        >
                          <IconClose className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={subiendoFotos}
                    onClick={() => subirLoteFotos(eventoActual.id)}
                    className="w-full bg-[#C85A17] hover:bg-[#AD4B10] disabled:opacity-60 text-white font-bold py-2 rounded text-xs"
                  >
                    {subiendoFotos
                      ? "Subiendo fotos..."
                      : `Subir ${fotosSeleccionadas.length} foto(s) a la galería`}
                  </button>
                </div>
              )}
            </div>
          )}

          {cargandoImagenes ? (
            <p className="text-xs text-stone-500 text-center py-6">Cargando fotos del evento...</p>
          ) : imagenesEvento.length === 0 ? (
            <div className="bg-[#FAF9F6] border border-[#D6D3CD] rounded p-6 text-center text-xs text-stone-500">
              Aún no hay fotos subidas para este evento.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
              {imagenesEvento.map((img) => {
                const esProp =
                  usuario &&
                  (Number(img.publicador?.id) === Number(usuario.id) ||
                    Boolean(cuentasNegocio[eventoActual?.negocio]?.esMio));
                return (
                  <div
                    key={img.id}
                    className="relative group border border-[#D6D3CD] rounded overflow-hidden bg-stone-100"
                  >
                    <button
                      type="button"
                      onClick={() => setFotoAmpliada(img)}
                      className="block w-full text-left"
                    >
                      <img
                        src={img.imagen}
                        alt={`Foto de ${img.publicador?.nombre || "asistente"}`}
                        loading="lazy"
                        className="w-full h-24 object-cover"
                      />
                    </button>
                    <div className="px-1.5 py-1 bg-white border-t border-[#E5E2DC] flex items-center justify-between gap-1">
                      <span className="text-[10px] font-semibold text-stone-600 truncate">
                        {img.publicador?.nombre || "Asistente"}
                      </span>
                      {esProp && (
                        <button
                          type="button"
                          onClick={() => handleEliminarFoto(img.id)}
                          aria-label="Eliminar foto"
                          className="text-[#7F1D1D] hover:text-[#991B1B] shrink-0"
                        >
                          <IconTrash className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {fotoAmpliada && (
            <div
              className="fixed inset-0 bg-black/85 z-[60] flex flex-col items-center justify-center p-4"
              onClick={() => setFotoAmpliada(null)}
            >
              <div
                className="max-w-2xl w-full bg-white rounded overflow-hidden border border-[#D6D3CD]"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={fotoAmpliada.imagen}
                  alt="Foto ampliada del evento"
                  className="w-full max-h-[75vh] object-contain bg-stone-950"
                />
                <div className="p-3 flex items-center justify-between gap-2 bg-white">
                  <span className="text-xs font-bold text-[#16324F]">
                    Subida por {fotoAmpliada.publicador?.nombre || "Asistente"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFotoAmpliada(null)}
                    className="bg-[#16324F] text-white text-xs font-bold px-3 py-1.5 rounded"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </BaseModal>
  );
}
