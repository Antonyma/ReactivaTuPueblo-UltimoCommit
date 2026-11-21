import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
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
import { useNetworkStatus } from "../hooks/useNetworkStatus.js";
import { cacheRepository } from "../services/offline/cacheRepository.js";
import { outboxRepository, OUTBOX_ACTION_TYPES } from "../services/offline/outboxRepository.js";
import { defaultSyncEngine, isNetworkFailure } from "../services/offline/syncEngine.js";
import { applyOutboxProjection } from "../services/offline/offlineProjection.js";

const AppContext = createContext();

const BASE_PREFIX = (import.meta.env?.BASE_URL || "/").replace(/\/+$/, "");

function normalizarRuta(pathname) {
  if (!pathname) return "/";
  const sinBase =
    BASE_PREFIX && pathname.startsWith(BASE_PREFIX)
      ? pathname.slice(BASE_PREFIX.length) || "/"
      : pathname;
  return sinBase.startsWith("/admin") ? "/admin" : "/";
}

function construirRutaConBase(ruta) {
  const normalizada = normalizarRuta(ruta);
  if (!BASE_PREFIX) return normalizada;
  return normalizada === "/" ? `${BASE_PREFIX}/` : `${BASE_PREFIX}${normalizada}`;
}

export function AppProvider({ children }) {
  const [rutaActual, setRutaActual] = useState(() =>
    normalizarRuta(typeof window !== "undefined" ? window.location.pathname : "/")
  );
  const [actividades, setActividades] = useState([]);
  const [cuentasNegocio, setCuentasNegocio] = useState({});
  const [usuario, setUsuario] = useState(() => getStoredUser());
  const [cargando, setCargando] = useState(true);
  const [letraGrande, setLetraGrande] = useState(false);
  const [puebloActivo, setPuebloActivo] = useState("Todos");
  const [misInscripcionesIds, setMisInscripcionesIds] = useState([]);
  const [inscripcionesPendientesIds, setInscripcionesPendientesIds] = useState([]);
  const [pendientesSyncCount, setPendientesSyncCount] = useState(() => outboxRepository.count());
  const [sincronizando, setSincronizando] = useState(false);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(
    () => cacheRepository.loadSnapshot().updatedAt
  );
  const [muestrasAprendidasModelo, setMuestrasAprendidasModelo] = useState(4);
  const [eventosAhorradosTokens, setEventosAhorradosTokens] = useState(0);
  const [ultimoWhatsAppPublicador, setUltimoWhatsAppPublicador] = useState(
    "Listo para notificar aprobación o rechazo al publicador."
  );

  const {
    isOnline,
    modoOfflineSimulado,
    toggleModoOfflineSimulado,
    puedeInstalarPwa,
    appInstalada,
    instalarPwa,
  } = useNetworkStatus();
  const isOnlineRef = useRef(isOnline);
  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

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
    const onPopState = () => {
      setRutaActual(normalizarRuta(window.location.pathname));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navegarA = useCallback((ruta) => {
    const destino = normalizarRuta(ruta);
    const urlDestino = construirRutaConBase(destino);
    if (window.location.pathname !== urlDestino) {
      window.history.pushState({}, "", urlDestino);
    }
    setRutaActual(destino);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

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

  const aplicarEstadoConProyeccion = useCallback((baseState, usuarioActivo) => {
    const ops = outboxRepository.getAll();
    const projected = applyOutboxProjection(baseState, ops, usuarioActivo);
    setActividades(projected.actividades);
    setEventosAhorradosTokens(projected.actividades.filter((e) => e.ahorroTokens).length);
    setCuentasNegocio(projected.cuentasNegocio);
    setMisInscripcionesIds(projected.misInscripcionesIds);
    setInscripcionesPendientesIds(projected.inscripcionesPendientesIds);
    setPendientesSyncCount(ops.length);
  }, []);

  const cargarDatosIniciales = useCallback(async (usuarioActivo) => {
    const cachedSnapshot = cacheRepository.loadSnapshot();
    const hayCache =
      cachedSnapshot.actividades.length > 0 ||
      Object.keys(cachedSnapshot.cuentasNegocio).length > 0;

    if (hayCache) {
      aplicarEstadoConProyeccion(cachedSnapshot, usuarioActivo);
      setUltimaActualizacion(cachedSnapshot.updatedAt);
      setCargando(false);
    } else {
      setCargando(true);
    }

    if (!isOnlineRef.current) {
      if (!hayCache) {
        aplicarEstadoConProyeccion(cachedSnapshot, usuarioActivo);
      }
      setCargando(false);
      return;
    }

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

      const mapNegocios = {};
      for (const neg of negociosRes?.data || []) {
        const mapped = mapNegocioFromApi(neg, usuarioActualizado);
        const resenasPrevias = cachedSnapshot.cuentasNegocio?.[mapped.nombre]?.resenas || [];
        mapNegocios[mapped.nombre] = { ...mapped, resenas: resenasPrevias };
      }

      let idsInscripciones = [];
      if (usuarioActualizado?.id && getAuthToken()) {
        try {
          const histRes = await usuariosApi.obtenerHistorial(usuarioActualizado.id);
          idsInscripciones = (histRes?.data || [])
            .filter((h) => h.estado !== "CANCELADA" && h.evento?.id)
            .map((h) => Number(h.evento.id));
        } catch {
          idsInscripciones = cachedSnapshot.misInscripcionesIds || [];
        }
      }

      const saved = cacheRepository.saveSnapshot({
        actividades: listaEventos,
        cuentasNegocio: mapNegocios,
        misInscripcionesIds: idsInscripciones,
      });
      setUltimaActualizacion(saved.updatedAt);
      aplicarEstadoConProyeccion(saved, usuarioActualizado);
    } catch (err) {
      if (hayCache && isNetworkFailure(err)) {
        mostrarToast("Sin conexión con el servidor. Mostrando los últimos eventos guardados.");
      } else if (!hayCache) {
        mostrarToast(`No se pudieron cargar los datos del servidor: ${err.message}`);
      }
    } finally {
      setCargando(false);
    }
  }, [aplicarEstadoConProyeccion, mostrarToast]);

  const sincronizarPendientes = useCallback(async () => {
    if (!isOnlineRef.current) {
      mostrarToast("Sigues sin conexión. Los cambios se enviarán automáticamente al reconectar.");
      return;
    }
    if (outboxRepository.count() === 0) return;

    setSincronizando(true);
    try {
      const result = await defaultSyncEngine.processQueue();
      setPendientesSyncCount(result.remaining);

      if (result.syncedCount > 0) {
        const resumen =
          result.syncedCount === 1
            ? `✅ ${result.syncedLabels[0]}`
            : `✅ ${result.syncedCount} cambios offline sincronizados con el servidor.`;
        mostrarToast(resumen);
      }

      if (result.conflicts.length > 0) {
        const primerConflicto = result.conflicts[0];
        mostrarToast(`Aviso al sincronizar: ${primerConflicto.reason}`);
      }

      if (result.syncedCount > 0 || result.conflicts.length > 0) {
        await cargarDatosIniciales(usuario);
      }
    } finally {
      setSincronizando(false);
    }
  }, [cargarDatosIniciales, mostrarToast, usuario]);

  useEffect(() => {
    cargarDatosIniciales(usuario);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isOnline) {
      if (outboxRepository.count() > 0) {
        sincronizarPendientes();
      } else {
        cargarDatosIniciales(usuario);
      }
    }
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const loginAdmin = async ({ nombre, password }) => {
    try {
      const res = await authApi.adminLogin({ nombre, password });
      await finalizarAutenticacion(res);
    } catch (err) {
      mostrarToast(`Acceso denegado: ${err.message}`);
      throw err;
    }
  };

  const crearAdmin = async ({ nombre, password }) => {
    try {
      const res = await authApi.registerAdmin({
        nombre,
        password,
      });
      const nuevoAdmin = res?.data?.usuario;
      mostrarToast(`Administrador "${nuevoAdmin?.nombre || nombre}" dado de alta correctamente.`);
      return nuevoAdmin;
    } catch (err) {
      mostrarToast(`Error al dar de alta administrador: ${err.message}`);
      throw err;
    }
  };

  const listarAdmins = useCallback(async () => {
    const res = await usuariosApi.listarAdmins();
    return res?.data || [];
  }, []);

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

    const encolarInscripcionOffline = () => {
      outboxRepository.enqueue({
        type: OUTBOX_ACTION_TYPES.INSCRIBIRSE_EVENTO,
        payload: { eventoId: id },
        meta: { eventoNombre: act.nombre },
      });
      aplicarEstadoConProyeccion(cacheRepository.loadSnapshot(), usuario);
      mostrarToast(
        `⏳ Guardado sin conexión: tu inscripción a "${act.nombre}" se enviará al recuperar red.`
      );
    };

    if (!isOnlineRef.current) {
      encolarInscripcionOffline();
      return;
    }

    try {
      await eventosApi.inscribirse(id);
      setActividades((prev) =>
        prev.map((a) => (a.id === id ? { ...a, asistentes: a.asistentes + 1 } : a))
      );
      setMisInscripcionesIds((prev) => [...prev, id]);
      mostrarToast(`Apuntado a "${act.nombre}". Te avisaremos por WhatsApp al ${usuario.telefono}.`);
    } catch (err) {
      if (isNetworkFailure(err)) {
        encolarInscripcionOffline();
        return;
      }
      mostrarToast(err.message);
    }
  };

  const desapuntarse = async (id) => {
    const act = actividades.find((a) => a.id === id);
    if (!act) return;

    const encolarBajaOffline = () => {
      outboxRepository.enqueue({
        type: OUTBOX_ACTION_TYPES.DESAPUNTARSE_EVENTO,
        payload: { eventoId: id },
        meta: { eventoNombre: act.nombre },
      });
      aplicarEstadoConProyeccion(cacheRepository.loadSnapshot(), usuario);
      mostrarToast(`⏳ Baja de "${act.nombre}" guardada sin conexión. Se sincronizará al reconectar.`);
    };

    if (!isOnlineRef.current) {
      encolarBajaOffline();
      return;
    }

    try {
      await eventosApi.desapuntarse(id);
      setActividades((prev) =>
        prev.map((a) => (a.id === id ? { ...a, asistentes: Math.max(0, a.asistentes - 1) } : a))
      );
      setMisInscripcionesIds((prev) => prev.filter((i) => i !== id));
      mostrarToast(`Te has desapuntado de "${act.nombre}".`);
    } catch (err) {
      if (isNetworkFailure(err)) {
        encolarBajaOffline();
        return;
      }
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
    const coordenadas =
      typeof nuevoData.coordenadas === "string" && nuevoData.coordenadas.trim()
        ? nuevoData.coordenadas.trim()
        : `${baseCoords[0]}, ${baseCoords[1]}`;
    const payload = {
      nombre: nuevoData.titulo,
      negocioId: negocioInfo.id,
      pueblo: nuevoData.pueblo,
      descripcion: nuevoData.descripcion,
      coordenadas,
      dePago: Boolean(nuevoData.dePago),
      aforo: Number(nuevoData.aforo),
      tipoEvento: CATEGORIA_A_TIPO_EVENTO[nuevoData.categoria] || 1,
      fechaInicio: nuevoData.fechaInicio,
      fechaFin: nuevoData.fechaFin,
      imagen: nuevoData.imagen || "",
    };

    const encolarEventoOffline = () => {
      const tempId = `temp_ev_${Date.now()}`;
      outboxRepository.enqueue({
        type: OUTBOX_ACTION_TYPES.PUBLICAR_EVENTO,
        payload,
        meta: { negocioNombre: nuevoData.negocio },
        tempId,
      });
      aplicarEstadoConProyeccion(cacheRepository.loadSnapshot(), usuario);
      mostrarToast(
        `⏳ Evento "${payload.nombre}" guardado sin conexión. Se enviará al recuperar cobertura.`
      );
    };

    if (!isOnlineRef.current) {
      encolarEventoOffline();
      return;
    }

    try {
      const res = await eventosApi.crear(payload);
      const nuevoEvento = mapEventoFromApi(res.data);
      setActividades((prev) => [nuevoEvento, ...prev]);

      if (nuevoEvento.estadoModeracion === "aprobada") {
        setEventosAhorradosTokens((prev) => prev + 1);
        mostrarToast(
          nuevoEvento.motivoIA || `Publicada al instante. "${nuevoData.negocio}" tiene pase directo.`
        );
      } else if (nuevoEvento.estadoModeracion === "denegada") {
        mostrarToast(
          `Actividad rechazada por Moderador IA: ${nuevoEvento.motivoIA || "No cumple las normas."}`
        );
      } else {
        mostrarToast(`Enviada a revisión: "${nuevoData.negocio}" queda pendiente de Moderador.`);
      }
    } catch (err) {
      if (isNetworkFailure(err)) {
        encolarEventoOffline();
        return;
      }
      mostrarToast(`No se pudo publicar el evento: ${err.message}`);
    }
  };

  const crearNegocio = async ({ nombre, pueblo, coordenadas, instagramUrl, twitterUrl, facebookUrl, webUrl }) => {
    const coords = municipiosMancomunidad[pueblo] || CENTRO_MANCOMUNIDAD;
    const coordenadasStr =
      typeof coordenadas === "string" && coordenadas.trim()
        ? coordenadas.trim()
        : `${coords[0]}, ${coords[1]}`;
    const payload = {
      nombre,
      pueblo,
      coordenadas: coordenadasStr,
      instagramUrl,
      twitterUrl,
      facebookUrl,
      webUrl,
      fiabilidad: 0,
    };

    const encolarNegocioOffline = () => {
      const tempId = `temp_neg_${Date.now()}`;
      outboxRepository.enqueue({
        type: OUTBOX_ACTION_TYPES.CREAR_NEGOCIO,
        payload,
        tempId,
      });
      aplicarEstadoConProyeccion(cacheRepository.loadSnapshot(), usuario);
      mostrarToast(
        `⏳ Comercio "${nombre}" guardado en el dispositivo sin red. Se sincronizará automáticamente al reconectar.`
      );
    };

    if (!isOnlineRef.current) {
      encolarNegocioOffline();
      return;
    }

    try {
      const res = await negociosApi.crear(payload);
      const mapped = mapNegocioFromApi(res.data, usuario);
      setCuentasNegocio((prev) => ({
        ...prev,
        [mapped.nombre]: mapped,
      }));
      mostrarToast(`Comercio "${mapped.nombre}" enviado. Queda pendiente hasta que un moderador lo confirme.`);
    } catch (err) {
      if (isNetworkFailure(err)) {
        encolarNegocioOffline();
        return;
      }
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
    { nombre, pueblo, coordenadas, instagramUrl, twitterUrl, facebookUrl, webUrl }
  ) => {
    const info = cuentasNegocio[nombreActual];
    if (!info?.id) return null;
    const coords = municipiosMancomunidad[pueblo] || CENTRO_MANCOMUNIDAD;
    const coordenadasStr =
      typeof coordenadas === "string" && coordenadas.trim()
        ? coordenadas.trim()
        : `${coords[0]}, ${coords[1]}`;
    const body = {
      nombre,
      pueblo,
      coordenadas: coordenadasStr,
      instagramUrl,
      twitterUrl,
      facebookUrl,
      webUrl,
    };

    const encolarEdicionOffline = () => {
      outboxRepository.enqueue({
        type: OUTBOX_ACTION_TYPES.ACTUALIZAR_NEGOCIO,
        payload: { id: info.id, ...body },
        meta: { nombreAnterior: nombreActual },
      });
      aplicarEstadoConProyeccion(cacheRepository.loadSnapshot(), usuario);
      mostrarToast(
        `⏳ Cambios en "${nombre}" guardados sin conexión. Se sincronizarán al recuperar red.`
      );
      return { ...info, ...body, pendienteSync: true };
    };

    if (!isOnlineRef.current) {
      return encolarEdicionOffline();
    }

    try {
      const res = await negociosApi.actualizar(info.id, body);
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
      if (isNetworkFailure(err)) {
        return encolarEdicionOffline();
      }
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
    if (!isOnlineRef.current || String(info.id).startsWith("temp_")) {
      return info.resenas || [];
    }
    try {
      const res = await negociosApi.listarValoraciones(info.id);
      const lista = (res?.data?.valoraciones || []).map((v) => ({
        id: v.id,
        usuario: v.usuario?.nombre || "Vecino",
        estrellas: v.estrellas,
        texto: v.texto,
      }));
      cacheRepository.updateBusinessReviews(nombreNegocio, lista);
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

    const encolarResenaOffline = () => {
      outboxRepository.enqueue({
        type: OUTBOX_ACTION_TYPES.CREAR_VALORACION,
        payload: { eventoId: eventoObjetivo.id, estrellas, texto },
        meta: { nombreNegocio },
      });
      aplicarEstadoConProyeccion(cacheRepository.loadSnapshot(), usuario);
      mostrarToast("⏳ Opinión guardada sin conexión. Se enviará automáticamente al reconectar.");
    };

    if (!isOnlineRef.current) {
      encolarResenaOffline();
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
      if (isNetworkFailure(err)) {
        encolarResenaOffline();
        return;
      }
      mostrarToast(err.message);
    }
  };

  return (
    <AppContext.Provider
      value={{
        rutaActual,
        navegarA,
        actividades,
        cuentasNegocio,
        usuario,
        cargando,
        letraGrande,
        setLetraGrande,
        puebloActivo,
        setPuebloActivo,
        misInscripcionesIds,
        inscripcionesPendientesIds,
        isOnline,
        modoOfflineSimulado,
        toggleModoOfflineSimulado,
        pendientesSyncCount,
        sincronizando,
        ultimaActualizacion,
        sincronizarPendientes,
        puedeInstalarPwa,
        appInstalada,
        instalarPwa,
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
        loginAdmin,
        crearAdmin,
        listarAdmins,
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
