/**
 * Adaptador de almacenamiento persistente (SRP + DIP).
 * Encapsula localStorage detrás de una interfaz mínima sustituible (LSP),
 * permitiendo cambiar el motor (p. ej. IndexedDB o memoria en tests) sin afectar repositorios.
 */

export function createLocalStorageAdapter(storage = typeof window !== "undefined" ? window.localStorage : null) {
  return {
    getJson(key, fallback = null) {
      if (!storage) return fallback;
      try {
        const raw = storage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    },

    setJson(key, value) {
      if (!storage) return false;
      try {
        storage.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },

    remove(key) {
      if (!storage) return;
      try {
        storage.removeItem(key);
      } catch {
        // ignore storage errors
      }
    },
  };
}

export const defaultStorageAdapter = createLocalStorageAdapter();

