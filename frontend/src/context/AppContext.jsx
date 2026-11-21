import React, { createContext, useContext, useState, useEffect } from "react";
import {
  actividadesIniciales,
  cuentasNegocioIniciales,
  resenasIniciales,
  evaluarFiabilidadNegocio,
  formatearTelefonoConPrefijo,
  formatearFechaBonita,
  municipiosMancomunidad,
  CENTRO_MANCOMUNIDAD
} from "../data/mockData.js";
import {
  moderarResenaConGemini,
  moderarImagenConGemini,
  moderarTituloActividadConGemini
} from "../services/geminiModeration.js";

const AppContext = createContext();

export function AppProvider({ children }) {
  const [actividades, setActividades] = useState(actividadesIniciales);
  const [cuentasNegocio, setCuentasNegocio] = useState(cuentasNegocioIniciales);
  const [resenas, setResenas] = useState(resenasIniciales);
  const [usuario, setUsuario] = useState(null); // { id, nombre, email, telefono, tipoUsuario }
  const [letraGrande, setLetraGrande] = useState(false);
  const [puebloActivo, setPuebloActivo] = useState("Todos");
  const [misInscripcionesIds, setMisInscripcionesIds] = useState([]);
  const [muestrasAprendidasModelo, setMuestrasAprendidasModelo] = useState(4);
  const [eventosAhorradosTokens, setEventosAhorradosTokens] = useState(3);
  const [ultimoWhatsAppPublicador, setUltimoWhatsAppPublicador] = useState(
    "Listo para notificar aprobación o rechazo al publicador."
  );

  // Modals state
  const [modalLogin, setModalLogin] = useState({ open: false, defaultTipo: "REGISTRADO", motivo: "" });
  const [modalCambiarHora, setModalCambiarHora] = useState({ open: false, actividad: null });
  const [modalDudas, setModalDudas] = useState({ open: false, actividad: null });
  const [modalResenas, setModalResenas] = useState({ open: false, nombreNegocio: null });
  const [modalInscritos, setModalInscritos] = useState({ open: false, actividad: null });

  // Toast
  const [toast, setToast] = useState({ open: false, mensaje: "" });
  const [accionPendienteTrasRegistro, setAccionPendienteTrasRegistro] = useState(null);

  useEffect(() => {
    if (letraGrande) {
      document.body.classList.add("letra-grande");
    } else {
      document.body.classList.remove("letra-grande");
    }
  }, [letraGrande]);

  const mostrarToast = (mensaje) => {
    setToast({ open: true, mensaje });
    setTimeout(() => {
      setToast({ open: false, mensaje: "" });
    }, 5500);
  };

  const notificarDecisionPublicadorWhatsApp = (act, decision) => {
    const infoNegocio = cuentasNegocio[act.negocio];
    const telPublicador = (infoNegocio && infoNegocio.telefonoPublicador)
      ? infoNegocio.telefonoPublicador
      : (usuario ? usuario.telefono : "+34600998877");

    const evalRef = evaluarFiabilidadNegocio(act.negocio, cuentasNegocio);
    const mensajeWhatsApp = decision === "APROBADA"
      ? `✅ Hola ${act.negocio}, tu actividad "${act.nombre}" en ${act.pueblo} ha sido APROBADA y ya es visible para los vecinos. (Nivel de referencia actual: ${evalRef.nivel}/3).`
      : `❌ Hola ${act.negocio}, tu actividad "${act.nombre}" en ${act.pueblo} ha sido DENEGADA por no cumplir las normas de publicación comarcal.`;

    const logStr = `Para ${telPublicador}: "${mensajeWhatsApp}"`;
    setUltimoWhatsAppPublicador(logStr);
    mostrarToast(`📲 WhatsApp enviado a ${act.negocio} (${telPublicador}): ${decision}`);
  };

  const loginUsuario = ({ nombre, email, telefono, tipoUsuario }) => {
    const formattedTel = formatearTelefonoConPrefijo(telefono);
    const u = { id: Date.now(), nombre, email, telefono: formattedTel, tipoUsuario };
    setUsuario(u);
    setModalLogin({ open: false, defaultTipo: "REGISTRADO", motivo: "" });

    if (accionPendienteTrasRegistro) {
      const idAct = accionPendienteTrasRegistro;
      setAccionPendienteTrasRegistro(null);
      const act = actividades.find((a) => a.id === idAct);
      if (act && act.asistentes < act.aforo && !misInscripcionesIds.includes(idAct)) {
        setActividades((prev) =>
          prev.map((a) => {
            if (a.id === idAct) {
              return {
                ...a,
                asistentes: a.asistentes + 1,
                listaInscritos: [
                  ...a.listaInscritos,
                  { nombre: u.nombre, email: u.email, telefono: u.telefono }
                ]
              };
            }
            return a;
          })
        );
        setMisInscripcionesIds((prev) => [...prev, idAct]);
        mostrarToast(`✅ ¡Bienvenido ${nombre}! Quedas apuntado a "${act.nombre}".`);
        return;
      }
    }

    mostrarToast(`Bienvenido/a ${nombre} (${tipoUsuario})`);
  };

  const cambiarRol = (nuevoRol) => {
    if (usuario) {
      setUsuario({ ...usuario, tipoUsuario: nuevoRol });
    } else {
      setModalLogin({
        open: true,
        defaultTipo: nuevoRol,
        motivo:
          nuevoRol === "MODERADOR"
            ? "Esta zona es exclusiva para el Moderador. Identifícate con rol Moderador para revisar actividades."
            : `Identifícate con rol ${nuevoRol}`
      });
    }
  };

  const apuntarse = (id) => {
    if (!usuario) {
      setAccionPendienteTrasRegistro(id);
      setModalLogin({
        open: true,
        defaultTipo: "REGISTRADO",
        motivo: "Escribe tus datos una sola vez para apuntarte a planes."
      });
      return;
    }
    const act = actividades.find((a) => a.id === id);
    if (!act || act.asistentes >= act.aforo) return;
    if (misInscripcionesIds.includes(id)) return;

    setActividades((prev) =>
      prev.map((a) => {
        if (a.id === id) {
          return {
            ...a,
            asistentes: a.asistentes + 1,
            listaInscritos: [
              ...a.listaInscritos,
              { nombre: usuario.nombre, email: usuario.email, telefono: usuario.telefono }
            ]
          };
        }
        return a;
      })
    );
    setMisInscripcionesIds((prev) => [...prev, id]);
    mostrarToast(`✅ ¡Apuntado a "${act.nombre}"! Te avisaremos por WhatsApp al ${usuario.telefono}.`);
  };

  const desapuntarse = (id) => {
    const act = actividades.find((a) => a.id === id);
    if (!act) return;

    setActividades((prev) =>
      prev.map((a) => {
        if (a.id === id) {
          return {
            ...a,
            asistentes: Math.max(0, a.asistentes - 1),
            listaInscritos: a.listaInscritos.filter((i) => i.email !== (usuario ? usuario.email : ""))
          };
        }
        return a;
      })
    );
    setMisInscripcionesIds((prev) => prev.filter((i) => i !== id));
    mostrarToast(`❌ Te has desapuntado de "${act.nombre}".`);
  };

  const guardarNuevaHora = (id, inicio, fin) => {
    const act = actividades.find((a) => a.id === id);
    if (!act) return;

    const fechaBonita = formatearFechaBonita(inicio);
    setActividades((prev) =>
      prev.map((a) => {
        if (a.id === id) {
          return {
            ...a,
            fechaInicioISO: inicio,
            fechaFinISO: fin,
            fecha: fechaBonita
          };
        }
        return a;
      })
    );
    setModalCambiarHora({ open: false, actividad: null });
    const numApuntados = act.listaInscritos.length;
    const aviso = numApuntados > 0
      ? `🕒 Hora actualizada a "${fechaBonita}". Se ha enviado aviso por WhatsApp a los ${numApuntados} apuntados.`
      : `🕒 Hora actualizada a "${fechaBonita}".`;
    mostrarToast(aviso);
  };

  const eliminarEvento = (id) => {
    setActividades((prev) => prev.filter((a) => a.id !== id));
    setMisInscripcionesIds((prev) => prev.filter((i) => i !== id));
    mostrarToast("🗑️ Evento eliminado.");
  };

  const publicarEvento = async (nuevoData) => {
    // 1. REGLA ESTRICTA: Penalización de palabras malsonantes en títulos de actividades de negocios
    const modTitulo = await moderarTituloActividadConGemini(nuevoData.titulo, nuevoData.descripcion);
    if (modTitulo.contieneMalasPalabras) {
      mostrarToast(`🚫 Actividad bloqueada: El título contiene palabras malsonantes (${modTitulo.palabrasDetectadas.join(", ")}).`);
      return {
        exito: false,
        motivo: `El título o descripción contiene palabras malsonantes (${modTitulo.palabrasDetectadas.join(", ")}). En PuebloVivo no se permiten insultos ni lenguaje ofensivo.`,
        palabras: modTitulo.palabrasDetectadas
      };
    }

    const evalRef = evaluarFiabilidadNegocio(nuevoData.negocio, cuentasNegocio);
    const esFiabilidad3 = evalRef.nivel >= 3;
    const baseCoords = municipiosMancomunidad[nuevoData.pueblo] || CENTRO_MANCOMUNIDAD;

    // 2. MODERACIÓN DE IMAGEN CON GEMINI BASADA EN CATEGORÍAS
    // - Fiabilidad 3 (Ayuntamiento): llamada ligera (gemini-2.5-flash-lite) con pase directo.
    // - Fiabilidad < 3: llamada fuerte (gemini-2.5-flash) que evalúa si la foto encaja con la categoría.
    const moderacionImg = await moderarImagenConGemini(
      nuevoData.imagen,
      evalRef.nivel,
      nuevoData,
      muestrasAprendidasModelo
    );

    // Si fiabilidad < 3 y la foto no tiene nada que ver con la categoría:
    const fotoIncoherente = !esFiabilidad3 && moderacionImg.coherenteConCategoria === false;

    // Pase directo solo si tiene Fiabilidad 3 (Ayuntamientos)
    const pasaSinRevision = esFiabilidad3;

    let estadoModeracion = "pendiente";
    if (pasaSinRevision) {
      estadoModeracion = "aprobada";
    } else if (fotoIncoherente) {
      estadoModeracion = "denegada";
    }

    const nuevoEvento = {
      id: Date.now(),
      nombre: nuevoData.titulo,
      pueblo: nuevoData.pueblo,
      negocio: nuevoData.negocio,
      categoria: nuevoData.categoria,
      descripcion: nuevoData.descripcion,
      coords: baseCoords,
      dePago: nuevoData.dePago,
      asistentes: 0,
      aforo: nuevoData.aforo,
      listaInscritos: [],
      fechaInicioISO: nuevoData.fechaInicio,
      fechaFinISO: nuevoData.fechaFin,
      fecha: formatearFechaBonita(nuevoData.fechaInicio),
      estadoModeracion,
      ahorroTokens: pasaSinRevision,
      motivoIA: pasaSinRevision
        ? `Pase directo por Fiabilidad Nivel 3/3 (Llamada ligera Gemini Flash-Lite)`
        : fotoIncoherente
        ? `❌ Denegada por Gemini Flash: La foto no tiene que ver con la categoría "${nuevoData.categoria}".`
        : `Cuenta Nivel ${evalRef.nivel}/3 · Revisión fuerte Gemini Flash (Categoría: ${nuevoData.categoria})`,
      moderacionImagen: moderacionImg,
      imagen: nuevoData.imagen || "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=800&q=80"
    };

    setActividades((prev) => [nuevoEvento, ...prev]);

    if (pasaSinRevision) {
      setEventosAhorradosTokens((prev) => prev + 1);
      if (cuentasNegocio[nuevoData.negocio]) {
        setCuentasNegocio((prev) => ({
          ...prev,
          [nuevoData.negocio]: {
            ...prev[nuevoData.negocio],
            actividadesAprobadas: prev[nuevoData.negocio].actividadesAprobadas + 1
          }
        }));
      }
      notificarDecisionPublicadorWhatsApp(nuevoEvento, "APROBADA");
      mostrarToast(
        `⚡ ¡Publicada! "${nuevoData.negocio}" es Nivel 3 (Ayuntamiento): Verificación ligera Gemini Flash-Lite completada.`
      );
      return { exito: true };
    }

    if (fotoIncoherente) {
      setMuestrasAprendidasModelo((prev) => prev + 1);
      notificarDecisionPublicadorWhatsApp(nuevoEvento, "DENEGADA");
      mostrarToast(`🚨 Actividad denegada por Gemini: La imagen no corresponde a la categoría "${nuevoData.categoria}".`);
      return {
        exito: false,
        motivo: `🚨 La imagen no tiene relación con la categoría "${nuevoData.categoria}". El modelo Gemini Flash ha bloqueado la publicación hasta que uses una foto acorde a la actividad.`
      };
    }

    mostrarToast(`⏳ Enviada a moderación: "${nuevoData.negocio}". Gemini Flash analizó la foto según la categoría "${nuevoData.categoria}".`);
    return { exito: true };
  };

  const crearNegocio = ({ nombre, pueblo, instagramUrl, facebookUrl }) => {
    setCuentasNegocio((prev) => ({
      ...prev,
      [nombre]: {
        id: Date.now(),
        nombre,
        esMio: true,
        pueblo,
        telefonoPublicador: usuario ? usuario.telefono : "+34600112233",
        actividadesAprobadas: 0,
        cuentaVerificada: false,
        fiabilidad: 1,
        instagramUrl,
        facebookUrl,
        resenas: []
      }
    }));
    mostrarToast(`✅ Negocio "${nombre}" guardado con Referencia Nivel 1/3.`);
  };

  const aprobarActividad = (id) => {
    const act = actividades.find((a) => a.id === id);
    if (!act) return;

    let nuevoNivel = 1;
    if (cuentasNegocio[act.negocio]) {
      const updatedCount = cuentasNegocio[act.negocio].actividadesAprobadas + 2;
      const updatedCuentas = {
        ...cuentasNegocio,
        [act.negocio]: {
          ...cuentasNegocio[act.negocio],
          actividadesAprobadas: updatedCount
        }
      };
      setCuentasNegocio(updatedCuentas);
      nuevoNivel = evaluarFiabilidadNegocio(act.negocio, updatedCuentas).nivel;
    }

    setActividades((prev) =>
      prev.map((a) => {
        if (a.id === id) {
          return {
            ...a,
            estadoModeracion: "aprobada",
            motivoIA: `Aprobada por Moderador · Negocio sube a Referencia Nivel ${nuevoNivel}/3`
          };
        }
        return a;
      })
    );

    setMuestrasAprendidasModelo((prev) => prev + 1);
    notificarDecisionPublicadorWhatsApp(act, "APROBADA");
  };

  const denegarActividad = (id) => {
    const act = actividades.find((a) => a.id === id);
    if (!act) return;

    setActividades((prev) =>
      prev.map((a) => {
        if (a.id === id) {
          return {
            ...a,
            estadoModeracion: "denegada",
            motivoIA: "Denegada por Moderador · Aviso enviado por WhatsApp al publicador"
          };
        }
        return a;
      })
    );

    setMuestrasAprendidasModelo((prev) => prev + 1);
    notificarDecisionPublicadorWhatsApp(act, "DENEGADA");
  };

  const agregarResena = async (nombreNegocio, estrellas, texto) => {
    const autor = usuario ? usuario.nombre : "Vecino";

    // 1. MODERACIÓN CON GEMINI (Detección de palabras malsonantes e insultos)
    // REGLA DEL MODERADOR: "Reseñas que pongan malas palabras se van (sin excepciones de fidelidad)"
    const analisisIA = await moderarResenaConGemini(texto);

    const nuevaResena = {
      id: Date.now(),
      negocio: nombreNegocio,
      usuario: autor,
      estrellas,
      texto,
      estado: analisisIA.contieneMalasPalabras ? "rechazada" : "aprobada",
      contieneMalasPalabras: analisisIA.contieneMalasPalabras,
      palabrasDetectadas: analisisIA.palabrasDetectadas,
      modeloIA: analisisIA.modelo,
      motivoIA: analisisIA.motivo,
      fecha: new Date().toISOString().split("T")[0]
    };

    setResenas((prev) => [nuevaResena, ...prev]);

    if (analisisIA.contieneMalasPalabras) {
      // Las reseñas con malas palabras SE VAN (no se publican en el negocio)
      mostrarToast(`🚫 Reseña bloqueada por Gemini: contiene palabras malsonantes (${analisisIA.palabrasDetectadas.join(", ")}).`);
      return {
        exito: false,
        motivo: analisisIA.motivo,
        palabras: analisisIA.palabrasDetectadas
      };
    }

    // Si está limpia, se añade a las opiniones públicas del negocio
    setCuentasNegocio((prev) => {
      const existe = prev[nombreNegocio] || {
        id: Date.now(),
        nombre: nombreNegocio,
        actividadesAprobadas: 0,
        resenas: []
      };
      return {
        ...prev,
        [nombreNegocio]: {
          ...existe,
          resenas: [{ usuario: autor, estrellas, texto }, ...existe.resenas]
        }
      };
    });

    mostrarToast("⭐ ¡Gracias! Tu opinión ha sido aprobada por Gemini y publicada.");
    return { exito: true };
  };

  const eliminarResena = (id) => {
    setResenas((prev) => prev.filter((r) => r.id !== id));
    mostrarToast("🗑️ Reseña eliminada del sistema.");
  };

  const restaurarResena = (id) => {
    setResenas((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          return {
            ...r,
            estado: "aprobada",
            contieneMalasPalabras: false,
            motivoIA: "Aprobada manualmente por el Moderador."
          };
        }
        return r;
      })
    );
    mostrarToast("✅ Reseña marcada como aprobada por el Moderador.");
  };

  return (
    <AppContext.Provider
      value={{
        actividades,
        cuentasNegocio,
        resenas,
        usuario,
        letraGrande,
        setLetraGrande,
        puebloActivo,
        setPuebloActivo,
        misInscripcionesIds,
        muestrasAprendidasModelo,
        eventosAhorradosTokens,
        ultimoWhatsAppPublicador,
        toast,
        mostrarToast,
        modalLogin,
        setModalLogin,
        modalCambiarHora,
        setModalCambiarHora,
        modalDudas,
        setModalDudas,
        modalResenas,
        setModalResenas,
        modalInscritos,
        setModalInscritos,
        loginUsuario,
        cambiarRol,
        apuntarse,
        desapuntarse,
        guardarNuevaHora,
        eliminarEvento,
        publicarEvento,
        crearNegocio,
        aprobarActividad,
        denegarActividad,
        agregarResena,
        eliminarResena,
        restaurarResena
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp debe usarse dentro de un AppProvider");
  }
  return context;
}
