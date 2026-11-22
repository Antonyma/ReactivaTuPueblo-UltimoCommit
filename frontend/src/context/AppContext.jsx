import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import { esEventoFinalizado } from "../utils/eventUtils.js";
import { AppContext } from "./useApp.js";

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
  const [resenasPorEvento, setResenasPorEvento] = useState({});
  const [usuario, setUsuario] = useState(() => getStoredUser());
  const [cargando, setCargando] = useState(true);
  const [letraGrande, setLetraGrande] = useState(false);
  const [puebloActivo, setPuebloActivo] = useState("Todos");
  const [misInscripcionesIds, setMisInscripcionesIds] = useState([]);
  const [misValoracionesEventoIds, setMisValoracionesEventoIds] = useState([]);
  const [inscripcionesPendientesIds, setInscripcionesPendientesIds] = useState([]);
  const [pendientesSyncCount, setPendientesSyncCount] = useState(() => outboxRepository.count());
  const [sincronizando, setSincronizando] = useState(false);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(
    () => cacheRepository.loadSnapshot().updatedAt
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
  const [modalResenas, setModalResenas] = useState({ open: false, nombreNegocio: null, eventoId: null });
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

  const toastTimerRef = useRef(null);
  const resenasPorEventoRef = useRef(resenasPorEvento);
  const cuentasNegocioRef = useRef(cuentasNegocio);
  const usuarioRef = useRef(usuario);
  const initialLoadDoneRef = useRef(false);
  const prevIsOnlineRef = useRef(isOnline);

  useEffect(() => {
    resenasPorEventoRef.current = resenasPorEvento;
  }, [resenasPorEvento]);

  useEffect(() => {
    cuentasNegocioRef.current = cuentasNegocio;
  }, [cuentasNegocio]);

  useEffect(() => {
    usuarioRef.current = usuario;
  }, [usuario]);

  const mostrarToast = useCallback((mensaje) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ open: true, mensaje });
    toastTimerRef.current = window.setTimeout(() => {
      setToast({ open: false, mensaje: "" });
      toastTimerRef.current = null;
    }, 5500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const aplicarEstadoConProyeccion = useCallback((baseState, usuarioActivo) => {
    const ops = outboxRepository.getAll();
    const projected = applyOutboxProjection(baseState, ops, usuarioActivo);
    setActividades(projected.actividades);
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
          if (rawMe && getAuthToken() === token) {
            usuarioActualizado = {
              ...rawMe,
              tipoUsuario: normalizeRoleForUi(rawMe.tipoUsuario),
            };
            setAuthSession(token, usuarioActualizado);
            setUsuario(usuarioActualizado);
          } else if (getAuthToken() !== token) {
            usuarioActualizado = null;
          }
        } catch (meErr) {
          if (meErr?.status === 401) {
            setAuthSession(null, null);
            setUsuario(null);
            usuarioActualizado = null;
          }
        }
      }

      const [eventosRes, negociosRes] = await Promise.all([
        eventosApi.listar(),
        negociosApi.listar(),
      ]);

      const listaEventosBase = (eventosRes?.data || []).map(mapEventoFromApi);

      const mapNegocios = {};
      for (const neg of negociosRes?.data || []) {
        const mapped = mapNegocioFromApi(neg, usuarioActualizado);
        const resenasPrevias = cachedSnapshot.cuentasNegocio?.[mapped.nombre]?.resenas || [];
        mapNegocios[mapped.nombre] = { ...mapped, resenas: resenasPrevias };
      }

      let idsInscripciones = [];
      let idsValorados = [];
      if (usuarioActualizado?.id && getAuthToken()) {
        try {
          const histRes = await usuariosApi.obtenerHistorial(usuarioActualizado.id);
          const histList = Array.isArray(histRes?.data?.historial)
            ? histRes.data.historial
            : Array.isArray(histRes?.data)
              ? histRes.data
              : [];
          idsInscripciones = histList
            .filter((h) => h.estado !== "CANCELADA" && h.evento?.id)
            .map((h) => Number(h.evento.id));
          idsValorados = histList
            .filter((h) => h.valoracion && h.evento?.id)
            .map((h) => Number(h.evento.id));
        } catch {
          idsInscripciones = cachedSnapshot.misInscripcionesIds || [];
        }
      }
      setMisValoracionesEventoIds(idsValorados);

      const saved = cacheRepository.saveSnapshot({
        actividades: listaEventosBase,
        cuentasNegocio: mapNegocios,
        misInscripcionesIds: idsInscripciones,
      });
      setUltimaActualizacion(saved.updatedAt);
      aplicarEstadoConProyeccion(saved, usuarioActualizado);
      setCargando(false);

      // Enriquecer con recomendaciones IA en segundo plano (no bloquea el render inicial)
      if (usuarioActualizado?.id && getAuthToken() && isOnlineRef.current && listaEventosBase.length > 0) {
        const AI_AGENTS_URL =
          (import.meta.env?.VITE_AI_AGENTS_URL || "http://localhost:8000").replace(/\/+$/, "");
        const ahoraRecMs = Date.now();
        const soloActivosParaRec = listaEventosBase.filter((e) => !esEventoFinalizado(e, ahoraRecMs));
        if (soloActivosParaRec.length === 0) return;
        fetch(`${AI_AGENTS_URL}/agents/recommend-activities`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(8000),
          body: JSON.stringify({
            usuario_id: String(usuarioActualizado.id),
            actividades_disponibles: soloActivosParaRec,
            excluir_ya_inscritas: true,
          }),
        })
          .then((recRes) => (recRes.ok ? recRes.json() : null))
          .then((recData) => {
            if (!recData) return;
            const ordenadas = Array.isArray(recData?.actividades_ordenadas)
              ? recData.actividades_ordenadas
              : [];
            const mapaRecomendadas = new Map();
            const ordenRank = new Map();
            ordenadas.forEach((a, idx) => {
              if (!a || a.id === undefined || a.id === null) return;
              const key = String(a.id);
              ordenRank.set(key, idx);
              if (a.es_recomendada || a.esRecomendada) {
                mapaRecomendadas.set(key, a.motivo_recommend || a.motivoRecomendacion || "");
              }
            });

            if (mapaRecomendadas.size === 0) return;

            setActividades((prev) =>
              prev.map((e) => {
                const key = String(e.id);
                if (!mapaRecomendadas.has(key) || esEventoFinalizado(e, Date.now())) return e;
                return {
                  ...e,
                  esRecomendada: true,
                  ordenRecomendacion: ordenRank.has(key)
                    ? ordenRank.get(key)
                    : Number.MAX_SAFE_INTEGER,
                  motivoRecomendacion: mapaRecomendadas.get(key) || e.motivoRecomendacion,
                };
              })
            );
          })
          .catch(() => {
            // Recomendaciones opcionales: si falla el servicio IA, la app sigue con el listado base
          });
      }
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
        await cargarDatosIniciales(usuarioRef.current);
      }
    } finally {
      setSincronizando(false);
    }
  }, [cargarDatosIniciales, mostrarToast]);

  useEffect(() => {
    let cancelled = false;
    const ejecutar = async () => {
      await Promise.resolve();
      if (cancelled) return;
      if (!initialLoadDoneRef.current) {
        initialLoadDoneRef.current = true;
        prevIsOnlineRef.current = isOnline;
        if (isOnline && outboxRepository.count() > 0) {
          await sincronizarPendientes();
        } else {
          await cargarDatosIniciales(usuarioRef.current);
        }
        return;
      }
      const volvioOnline = !prevIsOnlineRef.current && isOnline;
      prevIsOnlineRef.current = isOnline;
      if (volvioOnline) {
        if (outboxRepository.count() > 0) {
          await sincronizarPendientes();
        } else {
          await cargarDatosIniciales(usuarioRef.current);
        }
      }
    };
    ejecutar();
    return () => {
      cancelled = true;
    };
  }, [isOnline, cargarDatosIniciales, sincronizarPendientes]);

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

  const logoutUsuario = useCallback(() => {
    setAuthSession(null, null);
    usuarioRef.current = null;
    outboxRepository.clear();
    cacheRepository.clear();
    setUsuario(null);
    setMisInscripcionesIds([]);
    setMisValoracionesEventoIds([]);
    setInscripcionesPendientesIds([]);
    setPendientesSyncCount(0);
    setCuentasNegocio((prev) => {
      const next = {};
      for (const [k, v] of Object.entries(prev)) {
        next[k] = { ...v, esMio: false };
      }
      return next;
    });
    if (normalizarRuta(window.location.pathname) === "/admin") {
      navegarA("/");
    }
    mostrarToast("Has cerrado sesión.");
  }, [mostrarToast, navegarA]);

  const cambiarRol = (nuevoRol) => {
    if (usuario && usuario.tipoUsuario === nuevoRol) return;
    setModalLogin({
      open: true,
      defaultTipo: nuevoRol === "PUBLICADOR" ? "PUBLICADOR" : "REGISTRADO",
      motivo: `Inicia sesión o regístrate con rol ${nuevoRol}`,
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

  const guardarNuevaHora = async (id, inicio, fin, imagen) => {
    const act = actividades.find((a) => a.id === id);
    if (!act) return;

    const payload = { fechaInicio: inicio, fechaFin: fin };
    if (typeof imagen === "string" && imagen.trim()) {
      payload.imagen = imagen.trim();
    }

    try {
      await eventosApi.actualizar(id, payload);
      const fechaBonita = formatearFechaBonita(inicio);
      const fechaInicioMs = new Date(inicio).getTime();
      const fechaFinMs = new Date(fin).getTime();
      setActividades((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                fechaInicioISO: inicio,
                fechaFinISO: fin,
                fechaInicioMs: Number.isNaN(fechaInicioMs) ? a.fechaInicioMs : fechaInicioMs,
                fechaFinMs: Number.isNaN(fechaFinMs) ? a.fechaFinMs : fechaFinMs,
                fecha: fechaBonita,
                ...(payload.imagen ? { imagen: payload.imagen } : {}),
              }
            : a
        )
      );
      setModalCambiarHora({ open: false, actividad: null });
      mostrarToast(
        payload.imagen
          ? `Evento actualizado (horario y foto guardados).`
          : `Hora actualizada a "${fechaBonita}".`
      );
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

  const terminarEvento = async (id) => {
    try {
      const res = await eventosApi.terminar(id);
      const actualizado = res?.data ? mapEventoFromApi(res.data) : null;
      setActividades((prev) =>
        prev.map((a) =>
          a.id === id
            ? actualizado
              ? {
                  ...a,
                  ...actualizado,
                  esRecomendada: a.esRecomendada,
                  motivoRecomendacion: a.motivoRecomendacion,
                }
              : { ...a, fechaFinISO: new Date(Date.now() - 1000).toISOString() }
            : a
        )
      );
      mostrarToast("Evento marcado como terminado. Ya están habilitadas las reseñas para los asistentes.");
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
        payload: {
          ...payload,
          creadoOffline: true,
        },
        meta: { negocioNombre: nuevoData.negocio },
        tempId,
      });
      aplicarEstadoConProyeccion(cacheRepository.loadSnapshot(), usuario);
      mostrarToast(
        `⏳ Evento "${payload.nombre}" guardado sin conexión. Al recuperar cobertura pasará directamente a revisión del moderador.`
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
      mostrarToast(
        mapped.pendiente
          ? `Comercio "${mapped.nombre}" enviado. Queda pendiente hasta que un moderador lo confirme.`
          : `Comercio "${mapped.nombre}" verificado y confirmado por el filtro IA.`
      );
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

  const escanearRedesNegocio = async (nombreNegocio, { onProgress } = {}) => {
    const info = cuentasNegocio[nombreNegocio];
    if (!info?.id) return null;
    if (!isOnlineRef.current) {
      mostrarToast("Necesitas conexión a internet para escanear tus redes sociales.");
      return null;
    }
    try {
      const res = onProgress
        ? await negociosApi.escanearRedesStream(info.id, {}, onProgress)
        : await negociosApi.escanearRedes(info.id);
      const data = res?.data || {};
      const nuevos = Array.isArray(data.eventosCreados) ? data.eventosCreados : [];
      if (nuevos.length > 0) {
        const mapeados = nuevos.map((ev) => mapEventoFromApi(ev));
        setActividades((prev) => {
          const ids = new Set(prev.map((a) => Number(a.id)));
          const unicos = mapeados.filter((m) => !ids.has(Number(m.id)));
          return [...unicos, ...prev];
        });
      }
      mostrarToast(res?.message || data.mensaje || "Escaneo de redes completado.");
      return data;
    } catch (err) {
      mostrarToast(`Error al escanear redes: ${err.message}`);
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
      mostrarToast(`Actividad "${act.nombre}" denegada.`);
    } catch (err) {
      mostrarToast(err.message);
    }
  };

  const cargarResenasEvento = useCallback(async (eventoId) => {
    if (!eventoId || !isOnlineRef.current || String(eventoId).startsWith("temp_")) {
      return resenasPorEventoRef.current[eventoId] || [];
    }
    try {
      const res = await eventosApi.listarValoraciones(eventoId);
      const lista = (res?.data?.valoraciones || []).map((v) => ({
        id: v.id,
        eventoId: Number(eventoId),
        usuario: v.usuario?.nombre || "Vecino",
        estrellas: v.estrellas,
        texto: v.texto,
      }));
      setResenasPorEvento((prev) => ({
        ...prev,
        [eventoId]: lista,
      }));
      return lista;
    } catch {
      return resenasPorEventoRef.current[eventoId] || [];
    }
  }, []);

  const cargarResenasNegocio = useCallback(async (nombreNegocio) => {
    const info = cuentasNegocioRef.current[nombreNegocio];
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
  }, []);

  const agregarResena = async (nombreNegocio, estrellas, texto, eventoIdPreferido = null) => {
    if (!usuario || !getAuthToken()) {
      mostrarToast("Inicia sesión para poder dejar una reseña.");
      return false;
    }

    const ahora = Date.now();
    const eventosDelNegocio = actividades.filter((a) => a.negocio === nombreNegocio);
    const eventosAsistidos = eventosDelNegocio.filter((a) => misInscripcionesIds.includes(a.id));
    const eventosFinalizados = eventosAsistidos.filter((a) => esEventoFinalizado(a, ahora));
    const eventosPendientesValorar = eventosFinalizados.filter(
      (a) => !misValoracionesEventoIds.includes(a.id)
    );

    const eventoObjetivo =
      (eventoIdPreferido != null
        ? eventosPendientesValorar.find((a) => Number(a.id) === Number(eventoIdPreferido))
        : null) || eventosPendientesValorar[0];

    if (!eventoObjetivo) {
      if (eventosFinalizados.length > 0) {
        mostrarToast("Ya has valorado todos los eventos finalizados de este negocio.");
      } else if (eventosAsistidos.length > 0) {
        mostrarToast("Solo puedes reseñar cuando haya acabado el evento al que asististe.");
      } else {
        mostrarToast("Solo puedes reseñar si has asistido a un evento de este negocio y ya ha acabado.");
      }
      return false;
    }

    const encolarResenaOffline = () => {
      outboxRepository.enqueue({
        type: OUTBOX_ACTION_TYPES.CREAR_VALORACION,
        payload: { eventoId: eventoObjetivo.id, estrellas, texto },
        meta: { nombreNegocio },
      });
      setMisValoracionesEventoIds((prev) =>
        prev.includes(eventoObjetivo.id) ? prev : [...prev, eventoObjetivo.id]
      );
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
        eventoId: eventoObjetivo.id,
        usuario: usuario?.nombre || "Vecino",
        estrellas,
        texto,
      };
      setMisValoracionesEventoIds((prev) =>
        prev.includes(eventoObjetivo.id) ? prev : [...prev, eventoObjetivo.id]
      );
      setResenasPorEvento((prev) => ({
        ...prev,
        [eventoObjetivo.id]: [nueva, ...(prev[eventoObjetivo.id] || [])],
      }));
      setActividades((prev) =>
        prev.map((a) => {
          if (Number(a.id) !== Number(eventoObjetivo.id)) return a;
          const prevTotal = Number(a.totalValoraciones || 0);
          const prevSuma = (Number(a.mediaEstrellas || 0) * prevTotal) + Number(estrellas);
          const nextTotal = prevTotal + 1;
          return {
            ...a,
            totalValoraciones: nextTotal,
            mediaEstrellas: Number((prevSuma / nextTotal).toFixed(1)),
          };
        })
      );
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
      return true;
    } catch (err) {
      if (isNetworkFailure(err)) {
        encolarResenaOffline();
        return true;
      }
      mostrarToast(err.message);
      return false;
    }
  };

  const recargarDatos = useCallback(
    () => cargarDatosIniciales(usuarioRef.current),
    [cargarDatosIniciales]
  );

  const contextValue = useMemo(
    () => ({
      recargarDatos,
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
      misValoracionesEventoIds,
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
      terminarEvento,
      publicarEvento,
      crearNegocio,
      actualizarNegocio,
      eliminarNegocio,
      escanearRedesNegocio,
      aprobarNegocio,
      denegarNegocio,
      aprobarActividad,
      denegarActividad,
      resenasPorEvento,
      cargarResenasEvento,
      cargarResenasNegocio,
      agregarResena,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      rutaActual,
      navegarA,
      actividades,
      cuentasNegocio,
      usuario,
      cargando,
      letraGrande,
      puebloActivo,
      misInscripcionesIds,
      misValoracionesEventoIds,
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
      toast,
      mostrarToast,
      modalLogin,
      modalCambiarHora,
      modalDudas,
      modalResenas,
      modalInscritos,
      resenasPorEvento,
      cargarResenasEvento,
      cargarResenasNegocio,
    ]
  );

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
}
