const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
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
    throw new Error(message)
  }

  return payload
}

export const authApi = {
  login: ({ nombre, password }) =>
    apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ nombre, password }),
    }),
  register: ({ nombre, email, telefono, password, tipoUsuario }) =>
    apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ nombre, email, telefono, password, tipoUsuario }),
    }),
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
  listarValoraciones: (id) => apiFetch(`/negocios/${id}/valoraciones`),
}

export const usuariosApi = {
  obtenerHistorial: (id) => apiFetch(`/usuarios/${id}/historial`),
}
