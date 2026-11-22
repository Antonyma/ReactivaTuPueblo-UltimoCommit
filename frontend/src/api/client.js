import { isEffectivelyOffline } from '../services/offline/networkSimulation.js'

const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3000/api'
const TOKEN_STORAGE_KEY = 'pueblovivo_token'
const USER_STORAGE_KEY = 'pueblovivo_user'

export function getAuthToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

export function setAuthSession(token, usuario) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token)
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
    }
    if (usuario) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(usuario))
    } else {
      localStorage.removeItem(USER_STORAGE_KEY)
    }
  } catch {
    // ignore storage errors
  }
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export async function apiFetch(endpoint, options = {}) {
  if (isEffectivelyOffline()) {
    throw new TypeError('Sin conexión a internet. Esta acción requiere conexión.')
  }

  const token = getAuthToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      (typeof payload?.error === 'string' ? payload.error : null) ||
      payload?.message ||
      `HTTP error ${response.status}`
    const error = new Error(message)
    error.status = response.status
    error.isHttpError = true
    throw error
  }

  return payload
}

export const authApi = {
  login: ({ nombre, password }) =>
    apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ nombre, password }),
    }),
  adminLogin: ({ nombre, password }) =>
    apiFetch('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ nombre, password }),
    }),
  register: ({ nombre, email, telefono, password, tipoUsuario }) =>
    apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ nombre, email, telefono, password, tipoUsuario }),
    }),
  registerAdmin: ({ nombre, password }) =>
    apiFetch('/auth/admin/register', {
      method: 'POST',
      body: JSON.stringify({ nombre, password }),
    }),
  me: () => apiFetch('/auth/me'),
}

export const eventosApi = {
  listar: () => apiFetch('/eventos'),
  crear: (data) =>
    apiFetch('/eventos', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  actualizar: (id, data) =>
    apiFetch(`/eventos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  eliminar: (id) =>
    apiFetch(`/eventos/${id}`, {
      method: 'DELETE',
    }),
  terminar: (id) =>
    apiFetch(`/eventos/${id}/terminar`, {
      method: 'POST',
    }),
  inscribirse: (id) =>
    apiFetch(`/eventos/${id}/inscribirse`, {
      method: 'POST',
    }),
  desapuntarse: (id) =>
    apiFetch(`/eventos/${id}/inscribirse`, {
      method: 'DELETE',
    }),
  verInscritos: (id) => apiFetch(`/eventos/${id}/inscritos`),
  aprobar: (id, motivo) =>
    apiFetch(`/eventos/${id}/aprobar`, {
      method: 'POST',
      body: JSON.stringify({ motivo }),
    }),
  denegar: (id, motivo) =>
    apiFetch(`/eventos/${id}/denegar`, {
      method: 'POST',
      body: JSON.stringify({ motivo }),
    }),
  resolverDuda: (id, pregunta) =>
    apiFetch(`/eventos/${id}/dudas`, {
      method: 'POST',
      body: JSON.stringify({ pregunta }),
    }),
  listarValoraciones: (id) => apiFetch(`/eventos/${id}/valoraciones`),
  crearValoracion: (id, { estrellas, texto }) =>
    apiFetch(`/eventos/${id}/valoraciones`, {
      method: 'POST',
      body: JSON.stringify({ estrellas, texto }),
    }),
}

export const negociosApi = {
  listar: () => apiFetch('/negocios'),
  crear: (data) =>
    apiFetch('/negocios', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  actualizar: (id, data) =>
    apiFetch(`/negocios/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  eliminar: (id) =>
    apiFetch(`/negocios/${id}`, {
      method: 'DELETE',
    }),
  aprobar: (id) =>
    apiFetch(`/negocios/${id}/aprobar`, {
      method: 'PATCH',
    }),
  denegar: (id) =>
    apiFetch(`/negocios/${id}/denegar`, {
      method: 'PATCH',
    }),
  escanearRedes: (id, payload = {}) =>
    apiFetch(`/negocios/${id}/escanear-redes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  listarValoraciones: (id) => apiFetch(`/negocios/${id}/valoraciones`),
}

export const usuariosApi = {
  obtenerHistorial: (id) => apiFetch(`/usuarios/${id}/historial`),
  listarAdmins: () => apiFetch('/usuarios/admins'),
}
