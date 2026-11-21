import React, { useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { municipiosMancomunidad, evaluarFiabilidadNegocio } from "../constants/comarca.js";

export default function PublisherPanel() {
  const { cuentasNegocio, usuario, cambiarRol, publicarEvento, crearNegocio } = useApp();

  const [mostrarFormEvento, setMostrarFormEvento] = useState(false);
  const [mostrarFormNegocio, setMostrarFormNegocio] = useState(false);

  // Form Evento state
  const [titulo, setTitulo] = useState("");
  const [categoria, setCategoria] = useState("Fiesta Patronal");
  const [negocioSelect, setNegocioSelect] = useState("");
  const [pueblo, setPueblo] = useState("Lucainena de las Torres");
  const [aforo, setAforo] = useState(40);
  const [dePago, setDePago] = useState(false);
  const [fechaInicio, setFechaInicio] = useState("2026-11-29T12:00");
  const [fechaFin, setFechaFin] = useState("2026-11-29T14:00");
  const [descripcion, setDescripcion] = useState("");
  const [imagenBase64, setImagenBase64] = useState("");
  const [previewName, setPreviewName] = useState("");

  // Form Negocio state
  const [negNombre, setNegNombre] = useState("");
  const [negPueblo, setNegPueblo] = useState("Lucainena de las Torres");
  const [negInstagram, setNegInstagram] = useState("");
  const [negFacebook, setNegFacebook] = useState("");

  const misNegocios = Object.keys(cuentasNegocio).filter((k) => cuentasNegocio[k].esMio);

  // Initialize selected business if empty
  const defaultBusiness = negocioSelect || (misNegocios.length > 0 ? misNegocios[0] : "");

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagenBase64(ev.target.result);
      setPreviewName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleCrearEvento = (e) => {
    e.preventDefault();
    if (!defaultBusiness) return;
    publicarEvento({
      titulo,
      categoria,
      negocio: defaultBusiness,
      pueblo,
      aforo,
      dePago,
      fechaInicio,
      fechaFin,
      descripcion,
      imagen: imagenBase64
    });

    setTitulo("");
    setDescripcion("");
    setImagenBase64("");
    setPreviewName("");
    setMostrarFormEvento(false);
  };

  const handleCrearNegocio = (e) => {
    e.preventDefault();
    if (!negNombre.trim()) return;
    crearNegocio({
      nombre: negNombre.trim(),
      pueblo: negPueblo,
      instagramUrl: negInstagram.trim(),
      facebookUrl: negFacebook.trim()
    });
    setNegNombre("");
    setNegInstagram("");
    setNegFacebook("");
    setMostrarFormNegocio(false);
  };

  const pueblosArray = Object.keys(municipiosMancomunidad).sort();

  return (
    <section id="panel-publicador" className="caja-panel bg-white p-5 rounded-3xl shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-200 pb-3">
        <div>
          <span className="bg-blue-100 text-blue-950 text-xs font-black px-3 py-1 rounded-full">
            Panel de Publicador · Sistema de Referencia
          </span>
          <h2 className="text-xl font-black mt-1">Mis Negocios y Eventos</h2>
          <p className="text-xs text-stone-600">
            Negocios con <strong>Referencia Nivel 2 o 3</strong> publican al instante sin gastar tokens de revisión IA.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setMostrarFormNegocio(false);
              setMostrarFormEvento(!mostrarFormEvento);
            }}
            className="bg-blue-700 hover:bg-blue-800 text-white font-black px-4 py-3 rounded-2xl text-sm"
          >
            ➕ Publicar Evento
          </button>
          <button
            type="button"
            onClick={() => {
              setMostrarFormEvento(false);
              setMostrarFormNegocio(!mostrarFormNegocio);
            }}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-3 rounded-2xl text-sm"
          >
            🏪 Añadir Negocio / Redes
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

      {/* Formulario Crear Evento */}
      {mostrarFormEvento && (
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
              className="w-full border-2 border-blue-300 rounded-xl p-3 bg-white text-stone-900"
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Tipo de actividad *</label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full border-2 border-blue-300 rounded-xl p-3 bg-white text-stone-900"
            >
              <option value="Fiesta Patronal">🎉 Fiesta Patronal</option>
              <option value="Deportes">⚽ Deportes</option>
              <option value="Gastronomía">🍲 Gastronomía</option>
              <option value="Turismo">🥾 Paseo / Turismo</option>
              <option value="Comercio">🛍️ Comercio Local</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Negocio organizador *</label>
            <select
              value={defaultBusiness}
              onChange={(e) => setNegocioSelect(e.target.value)}
              required
              className="w-full border-2 border-blue-300 rounded-xl p-3 bg-white text-stone-900"
            >
              {misNegocios.map((nombre) => {
                const evalRef = evaluarFiabilidadNegocio(nombre, cuentasNegocio);
                return (
                  <option key={nombre} value={nombre}>
                    {nombre} ({evalRef.esDeConfianza ? `Ref. ${evalRef.nivel}/3 · Directo` : "Ref. 1/3 · Revisión"})
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Pueblo *</label>
            <select
              value={pueblo}
              onChange={(e) => setPueblo(e.target.value)}
              className="w-full border-2 border-blue-300 rounded-xl p-3 bg-white text-stone-900"
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
                className="w-full border-2 border-blue-300 rounded-xl p-3 bg-white text-stone-900"
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Precio</label>
              <select
                value={dePago ? "true" : "false"}
                onChange={(e) => setDePago(e.target.value === "true")}
                className="w-full border-2 border-blue-300 rounded-xl p-3 bg-white text-stone-900"
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
              className="w-full border-2 border-blue-300 rounded-xl p-3 bg-white text-stone-900"
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Fecha y hora fin *</label>
            <input
              type="datetime-local"
              required
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full border-2 border-blue-300 rounded-xl p-3 bg-white text-stone-900"
            />
          </div>

          <div className="md:col-span-2 bg-white text-stone-900 border-2 border-dashed border-blue-400 rounded-2xl p-4 space-y-2">
            <label className="block text-sm font-black">
              🖼️ Foto o cartel del evento (si el negocio es Nivel 1 pasará por el Moderador) *
            </label>
            <input type="file" accept="image/*" onChange={handleImageChange} className="w-full text-sm" />
            {imagenBase64 && (
              <div className="flex items-center gap-3 pt-2">
                <img src={imagenBase64} alt="Vista previa" className="w-20 h-20 object-cover rounded-xl border" />
                <span className="text-xs font-bold text-stone-700">{previewName}</span>
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
              className="w-full border-2 border-blue-300 rounded-xl p-3 bg-white text-stone-900"
            ></textarea>
          </div>
          <div className="md:col-span-2 flex gap-2 justify-end">
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
      {mostrarFormNegocio && (
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
              className="w-full border-2 border-blue-300 rounded-xl p-3 bg-white text-stone-900"
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Pueblo *</label>
            <select
              value={negPueblo}
              onChange={(e) => setNegPueblo(e.target.value)}
              className="w-full border-2 border-blue-300 rounded-xl p-3 bg-white text-stone-900"
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
              className="w-full border-2 border-blue-300 rounded-xl p-3 bg-white text-stone-900"
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Facebook o Web (opcional)</label>
            <input
              type="url"
              placeholder="https://facebook.com/..."
              value={negFacebook}
              onChange={(e) => setNegFacebook(e.target.value)}
              className="w-full border-2 border-blue-300 rounded-xl p-3 bg-white text-stone-900"
            />
          </div>
          <div className="md:col-span-2 flex gap-2 justify-end">
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
              Guardar Negocio (Inicia en Nivel 1)
            </button>
          </div>
        </form>
      )}

      {/* Lista de mis negocios */}
      <div id="lista-cuentas-ia" className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        {misNegocios.map((nombre) => {
          const info = cuentasNegocio[nombre];
          const evalRef = evaluarFiabilidadNegocio(nombre, cuentasNegocio);
          const badgeColor = evalRef.esDeConfianza
            ? "bg-emerald-100 text-emerald-900"
            : "bg-amber-100 text-amber-900";

          return (
            <div
              key={nombre}
              className="p-3 bg-blue-50/70 rounded-2xl border border-blue-200 flex justify-between items-center gap-2"
            >
              <div>
                <p className="font-black">{nombre}</p>
                <p className="text-xs text-stone-600">
                  📍 {info.pueblo} · {evalRef.motivo}
                </p>
              </div>
              <span className={`${badgeColor} text-xs font-black px-2.5 py-1 rounded-lg shrink-0`}>
                Ref. {evalRef.nivel}/3
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
