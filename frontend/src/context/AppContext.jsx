import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  authApi,
  eventosApi,
  negociosApi,
  usuariosApi,
  getAuthToken,
  getStoredUser,
  setAuthSession,
} from "../api/client.js";
import {
  mapEventoFromApi,
  mapNegocioFromApi,
  normalizeRoleForApi,
  normalizeRoleForUi,
} from "../api/mappers.js";
import {
  CATEGORIA_A_TIPO_EVENTO,
  CENTRO_MANCOMUNIDAD,
  formatearFechaBonita,
  formatearTelefonoConPrefijo,
  municipiosMancomunidad,
} from "../constants/comarca.js";

const AppContext = createContext();

export function AppProvider({ children }) {
  const [actividades, setActividades] = useState([]);
  const [cuentasNegocio, setCuentasNegocio] = useState({});
  const [usuario, setUsuario] = useState(() => getStoredUser());
  const [cargando, setCargando] = useState(true);
  const [letraGrande, setLetraGrande] = useState(false);
  const [puebloActivo, setPuebloActivo] = useState("Todos");
  const [misInscripcionesIds, setMisInscripcionesIds] = useState([]);
  const [muestrasAprendidasModelo, setMuestrasAprendidasModelo] = useState(4);
  const [eventosAhorradosTokens, setEventosAhorradosTokens] = useState(0);
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

  const mostrarToast = useCallback((mensaje) => {
    setToast({ open: true, mensaje });
    setTimeout(() => {
      setToast({ open: false, mensaje: "" });
    }, 5500);
  }, []);

  const cargarDatosIniciales = useCallback(async (usuarioActivo) => {
    setCargando(true);
    try {
      let usuarioActualizado = usuarioActivo;
      const token = getAuthToken();
      if (token) {
        try {
          const meRes = await authApi.me();
          const rawMe = meRes?.data?.usuario;
          if (rawMe) {
            usuarioActualizado = {
              ...rawMe,
              tipoUsuario: normalizeRoleForUi(rawMe.tipoUsuario),
            };
            setAuthSession(token, usuarioActualizado);
            setUsuario(usuarioActualizado);
          }
        } catch {
          // Si el token expiró o no es válido, mantenemos el estado o limpiamos
        }
      }

      const [eventosRes, negociosRes] = await Promise.all([
        eventosApi.listar(),
        negociosApi.listar(),
      ]);

      const listaEventos = (eventosRes?.data || []).map(mapEventoFromApi);
      setActividades(listaEventos);
      setEventosAhorradosTokens(listaEventos.filter((e) => e.ahorroTokens).length);

      const mapNegocios = {};
      for (const neg of negociosRes?.data || []) {
        const mapped = mapNegocioFromApi(neg, usuarioActualizado);
        mapNegocios[mapped.nombre] = mapped;
      }
      setCuentasNegocio(mapNegocios);

      if (usuarioActualizado?.id && getAuthToken()) {
        try {
          const histRes = await usuariosApi.obtenerHistorial(usuarioActualizado.id);
          const ids = (histRes?.data || [])
            .filter((h) => h.estado !== "CANCELADA" && h.evento?.id)
            .map((h) => Number(h.evento.id));
          setMisInscripcionesIds(ids);
        } catch {
          setMisInscripcionesIds([]);
        }
      } else {
        setMisInscripcionesIds([]);
      }
    } catch (err) {
      mostrarToast(`No se pudieron cargar los datos del servidor: ${err.message}`);
    } finally {
      setCargando(false);
    }
  }, [mostrarToast]);

  useEffect(() => {
    cargarDatosIniciales(usuario);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const finalizarAutenticacion = async (authPayload) => {
    const rawUser = authPayload?.data?.usuario;
    const token = authPayload?.data?.token;
    if (!rawUser || !token) {
      throw new Error("Respuesta de autenticación incompleta");
    }

    const u = {
      ...rawUser,
      tipoUsuario: normalizeRoleForUi(rawUser.tipoUsuario),
    };
    console.log("[DEBUG Auth] usuario:", u);
    setAuthSession(token, u);
    setUsuario(u);
    setModalLogin({ open: false, defaultTipo: "REGISTRADO", motivo: "" });

    await cargarDatosIniciales(u);

    if (accionPendienteTrasRegistro) {
      const idAct = accionPendienteTrasRegistro;
      setAccionPendienteTrasRegistro(null);
      try {
        await eventosApi.inscribirse(idAct);
        setMisInscripcionesIds((prev) => (prev.includes(idAct) ? prev : [...prev, idAct]));
        setActividades((prev) =>
          prev.map((a) => (a.id === idAct ? { ...a, asistentes: a.asistentes + 1 } : a))
        );
        mostrarToast(`Bienvenido ${u.nombre}. Quedas apuntado a la actividad.`);
        return;
      } catch (err) {
        mostrarToast(err.message);
        return;
      }
    }

    mostrarToast(`Bienvenido/a ${u.nombre} (${u.tipoUsuario})`);
  };

  const loginUsuario = async ({ nombre, password }) => {
    try {
      const res = await authApi.login({ nombre, password });
      await finalizarAutenticacion(res);
    } catch (err) {
      mostrarToast(`Error al entrar: ${err.message}`);
      throw err;
    }
  };

  const registerUsuario = async ({ nombre, email, telefono, password, tipoUsuario }) => {
    try {
      const formattedTel = formatearTelefonoConPrefijo(telefono);
      const res = await authApi.register({
        nombre,
        email,
        telefono: formattedTel,
        password,
        tipoUsuario: normalizeRoleForApi(tipoUsuario),
      });
      await finalizarAutenticacion(res);
    } catch (err) {
      mostrarToast(`Error al registrarse: ${err.message}`);
      throw err;
    }
  };

  const logoutUsuario = () => {
    setAuthSession(null, null);
    setUsuario(null);
    setMisInscripcionesIds([]);
    setCuentasNegocio((prev) => {
      const next = {};
      for (const [k, v] of Object.entries(prev)) {
        next[k] = { ...v, esMio: false };
      }
      return next;
    });
    mostrarToast("Has cerrado sesión.");
  };

  const cambiarRol = (nuevoRol) => {
    if (usuario && usuario.tipoUsuario === nuevoRol) return;
    setModalLogin({
      open: true,
      defaultTipo: nuevoRol,
      motivo:
        nuevoRol === "MODERADOR"
          ? "Esta zona es exclusiva para el Moderador. Inicia sesión o regístrate con rol Moderador."
          : `Inicia sesión o regístrate con rol ${nuevoRol}`
    });
  };

  const apuntarse = async (id) => {
    if (!usuario || !getAuthToken()) {
      setAccionPendienteTrasRegistro(id);
      setModalLogin({
        open: true,
        defaultTipo: "REGISTRADO",
        motivo: "Inicia sesión o regístrate una sola vez para apuntarte a planes."
      });
      return;
    }
    const act = actividades.find((a) => a.id === id);
    if (!act || act.asistentes >= act.aforo || misInscripcionesIds.includes(id)) return;

    try {
      await eventosApi.inscribirse(id);
      setActividades((prev) =>
        prev.map((a) => (a.id === id ? { ...a, asistentes: a.asistentes + 1 } : a))
      );
      setMisInscripcionesIds((prev) => [...prev, id]);
      mostrarToast(`Apuntado a "${act.nombre}". Te avisaremos por WhatsApp al ${usuario.telefono}.`);
    } catch (err) {
      mostrarToast(err.message);
    }
  };

  const desapuntarse = async (id) => {
    const act = actividades.find((a) => a.id === id);
    if (!act) return;

    try {
      await eventosApi.desapuntarse(id);
      setActividades((prev) =>
        prev.map((a) => (a.id === id ? { ...a, asistentes: Math.max(0, a.asistentes - 1) } : a))
      );
      setMisInscripcionesIds((prev) => prev.filter((i) => i !== id));
      mostrarToast(`Te has desapuntado de "${act.nombre}".`);
    } catch (err) {
      mostrarToast(err.message);
    }
  };

  const guardarNuevaHora = async (id, inicio, fin) => {
    const act = actividades.find((a) => a.id === id);
    if (!act) return;

    try {
      await eventosApi.actualizar(id, { fechaInicio: inicio, fechaFin: fin });
      const fechaBonita = formatearFechaBonita(inicio);
      setActividades((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, fechaInicioISO: inicio, fechaFinISO: fin, fecha: fechaBonita } : a
        )
      );
      setModalCambiarHora({ open: false, actividad: null });
      mostrarToast(`Hora actualizada a "${fechaBonita}".`);
    } catch (err) {
      mostrarToast(err.message);
    }
  };

  const eliminarEvento = async (id) => {
    try {
      await eventosApi.eliminar(id);
      setActividades((prev) => prev.filter((a) => a.id !== id));
      setMisInscripcionesIds((prev) => prev.filter((i) => i !== id));
      mostrarToast("Evento eliminado.");
    } catch (err) {
      mostrarToast(err.message);
    }
  };

  const publicarEvento = async (nuevoData) => {
    const negocioInfo = cuentasNegocio[nuevoData.negocio];
    if (!negocioInfo?.id) {
      mostrarToast("Selecciona un negocio válido antes de publicar.");
      return;
    }

    const baseCoords = municipiosMancomunidad[nuevoData.pueblo] || CENTRO_MANCOMUNIDAD;
    const payload = {
      nombre: nuevoData.titulo,
      negocioId: negocioInfo.id,
      pueblo: nuevoData.pueblo,
      descripcion: nuevoData.descripcion,
      coordenadas: `${baseCoords[0]}, ${baseCoords[1]}`,
      dePago: Boolean(nuevoData.dePago),
      aforo: Number(nuevoData.aforo),
      tipoEvento: CATEGORIA_A_TIPO_EVENTO[nuevoData.categoria] || 1,
      fechaInicio: nuevoData.fechaInicio,
      fechaFin: nuevoData.fechaFin,
      imagen: nuevoData.imagen || "",
    };

    try {
      const res = await eventosApi.crear(payload);
      const nuevoEvento = mapEventoFromApi(res.data);
      setActividades((prev) => [nuevoEvento, ...prev]);

      if (nuevoEvento.estadoModeracion === "aprobada") {
        setEventosAhorradosTokens((prev) => prev + 1);
        mostrarToast(`Publicada al instante. "${nuevoData.negocio}" tiene pase directo.`);
      } else {
        mostrarToast(`Enviada a revisión: "${nuevoData.negocio}" queda pendiente de Moderador.`);
      }
    } catch (err) {
      mostrarToast(`No se pudo publicar el evento: ${err.message}`);
    }
  };

  const crearNegocio = async ({ nombre, pueblo, instagramUrl, twitterUrl, facebookUrl, webUrl }) => {
    const coords = municipiosMancomunidad[pueblo] || CENTRO_MANCOMUNIDAD;
    try {
      const res = await negociosApi.crear({
        nombre,
        pueblo,
        coordenadas: `${coords[0]}, ${coords[1]}`,
        instagramUrl,
        twitterUrl,
        facebookUrl,
        webUrl,
        fiabilidad: 0,
      });
      const mapped = mapNegocioFromApi(res.data, usuario);
      setCuentasNegocio((prev) => ({
        ...prev,
        [mapped.nombre]: mapped,
      }));
      mostrarToast(`Comercio "${mapped.nombre}" enviado. Queda pendiente hasta que un moderador lo confirme.`);
    } catch (err) {
      mostrarToast(`Error al crear negocio: ${err.message}`);
    }
  };

  const aprobarNegocio = async (nombreNegocio) => {
    const info = cuentasNegocio[nombreNegocio];
    if (!info?.id) return;
    try {
      const res = await negociosApi.aprobar(info.id);
      const mapped = mapNegocioFromApi(res.data, usuario);
      setCuentasNegocio((prev) => ({
        ...prev,
        [mapped.nombre]: { ...mapped, resenas: info.resenas || [] },
      }));
      mostrarToast(`Comercio "${mapped.nombre}" confirmado.`);
    } catch (err) {
      mostrarToast(err.message);
    }
  };

  const denegarNegocio = async (nombreNegocio) => {
    const info = cuentasNegocio[nombreNegocio];
    if (!info?.id) return;
    try {
      await negociosApi.denegar(info.id);
      setCuentasNegocio((prev) => {
        const next = { ...prev };
        delete next[nombreNegocio];
        return next;
      });
      mostrarToast(`Comercio "${nombreNegocio}" denegado y eliminado.`);
    } catch (err) {
      mostrarToast(err.message);
    }
  };

  const actualizarNegocio = async (
    nombreActual,
    { nombre, pueblo, instagramUrl, twitterUrl, facebookUrl, webUrl }
  ) => {
    const info = cuentasNegocio[nombreActual];
    if (!info?.id) return null;
    const coords = municipiosMancomunidad[pueblo] || CENTRO_MANCOMUNIDAD;
    try {
      const res = await negociosApi.actualizar(info.id, {
        nombre,
        pueblo,
        coordenadas: `${coords[0]}, ${coords[1]}`,
        instagramUrl,
        twitterUrl,
        facebookUrl,
        webUrl,
      });
      const mapped = mapNegocioFromApi(res.data, usuario);
      setCuentasNegocio((prev) => {
        const next = { ...prev };
        if (nombreActual !== mapped.nombre) {
          delete next[nombreActual];
        }
        next[mapped.nombre] = { ...mapped, resenas: info.resenas || [] };
        return next;
      });
      if (nombreActual !== mapped.nombre) {
        setActividades((prev) =>
          prev.map((a) => (a.negocio === nombreActual ? { ...a, negocio: mapped.nombre } : a))
        );
      }
      mostrarToast(`Negocio "${mapped.nombre}" actualizado.`);
      return mapped;
    } catch (err) {
      mostrarToast(`Error al actualizar negocio: ${err.message}`);
      throw err;
    }
  };

  const eliminarNegocio = async (nombreNegocio) => {
    const info = cuentasNegocio[nombreNegocio];
    if (!info?.id) return;
    try {
      await negociosApi.eliminar(info.id);
      setCuentasNegocio((prev) => {
        const next = { ...prev };
        delete next[nombreNegocio];
        return next;
      });
      setActividades((prev) => prev.filter((a) => a.negocio !== nombreNegocio));
      mostrarToast(`Negocio "${nombreNegocio}" eliminado.`);
    } catch (err) {
      mostrarToast(`Error al eliminar negocio: ${err.message}`);
      throw err;
    }
  };

  const aprobarActividad = async (id) => {
    const act = actividades.find((a) => a.id === id);
    if (!act) return;

    try {
      const motivo = "Aprobada por Moderador · Verificada";
      await eventosApi.aprobar(id, motivo);
      setActividades((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, estadoModeracion: "aprobada", motivoIA: motivo } : a
        )
      );
      setMuestrasAprendidasModelo((prev) => prev + 1);
      setUltimoWhatsAppPublicador(`Actividad "${act.nombre}" aprobada y visible para los vecinos.`);
      mostrarToast(`Actividad "${act.nombre}" aprobada.`);
    } catch (err) {
      mostrarToast(err.message);
    }
  };

  const denegarActividad = async (id) => {
    const act = actividades.find((a) => a.id === id);
    if (!act) return;

    try {
      const motivo = "Denegada por Moderador · No cumple las normas comarcales";
      await eventosApi.denegar(id, motivo);
      setActividades((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, estadoModeracion: "denegada", motivoIA: motivo } : a
        )
      );
      setMuestrasAprendidasModelo((prev) => prev + 1);
      setUltimoWhatsAppPublicador(`Actividad "${act.nombre}" denegada.`);
      mostrarToast(`Actividad "${act.nombre}" denegada.`);
    } catch (err) {
      mostrarToast(err.message);
    }
  };

  const cargarResenasNegocio = useCallback(async (nombreNegocio) => {
    const info = cuentasNegocio[nombreNegocio];
    if (!info?.id) return [];
    try {
      const res = await negociosApi.listarValoraciones(info.id);
      const lista = (res?.data?.valoraciones || []).map((v) => ({
        id: v.id,
        usuario: v.usuario?.nombre || "Vecino",
        estrellas: v.estrellas,
        texto: v.texto,
      }));
      setCuentasNegocio((prev) => ({
        ...prev,
        [nombreNegocio]: { ...prev[nombreNegocio], resenas: lista },
      }));
      return lista;
    } catch {
      return info.resenas || [];
    }
  }, [cuentasNegocio]);

  const agregarResena = async (nombreNegocio, estrellas, texto) => {
    if (!usuario || !getAuthToken()) {
      mostrarToast("Inicia sesión para poder dejar una reseña.");
      return;
    }

    const ahora = Date.now();
    const eventosDelNegocio = actividades.filter((a) => a.negocio === nombreNegocio);
    const eventosAsistidos = eventosDelNegocio.filter((a) => misInscripcionesIds.includes(a.id));
    const eventoObjetivo = eventosAsistidos.find((a) => {
      if (!a.fechaFinISO) return false;
      const finMs = new Date(a.fechaFinISO).getTime();
      return !Number.isNaN(finMs) && finMs <= ahora;
    });

    if (!eventoObjetivo) {
      if (eventosAsistidos.length > 0) {
        mostrarToast("Solo puedes reseñar cuando haya acabado el evento al que asististe.");
      } else {
        mostrarToast("Solo puedes reseñar si has asistido a un evento de este negocio y ya ha acabado.");
      }
      return;
    }

    try {
      const res = await eventosApi.crearValoracion(eventoObjetivo.id, { estrellas, texto });
      const nueva = {
        id: res?.data?.id,
        usuario: usuario?.nombre || "Vecino",
        estrellas,
        texto,
      };
      setCuentasNegocio((prev) => {
        const existe = prev[nombreNegocio];
        if (!existe) return prev;
        return {
          ...prev,
          [nombreNegocio]: {
            ...existe,
            resenas: [nueva, ...(existe.resenas || [])],
          },
        };
      });
      mostrarToast("Gracias, tu opinión se ha guardado.");
    } catch (err) {
      mostrarToast(err.message);
    }
  };

  return (
    <AppContext.Provider
      value={{
        actividades,
        cuentasNegocio,
        usuario,
        cargando,
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
        registerUsuario,
        logoutUsuario,
        cambiarRol,
        apuntarse,
        desapuntarse,
        guardarNuevaHora,
        eliminarEvento,
        publicarEvento,
        crearNegocio,
        actualizarNegocio,
        eliminarNegocio,
        aprobarNegocio,
        denegarNegocio,
        aprobarActividad,
        denegarActividad,
        cargarResenasNegocio,
        agregarResena,
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
