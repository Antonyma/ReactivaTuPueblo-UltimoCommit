import { defaultStorageAdapter } from "./storageAdapter.js";

const CACHE_SNAPSHOT_KEY = "pueblovivo_offline_cache_v1";

const EMPTY_SNAPSHOT = {
  actividades: [],
  cuentasNegocio: {},
  misInscripcionesIds: [],
  updatedAt: null,
};

/**
 * Repositorio de caché de lectura (SRP + DIP).
 * Persiste el último estado conocido de eventos, comercios e inscripciones
 * para consulta instantánea sin conexión.
 */
export function createCacheRepository(storage = defaultStorageAdapter) {
  return {
    loadSnapshot() {
      const data = storage.getJson(CACHE_SNAPSHOT_KEY, null);
      if (!data || typeof data !== "object") {
        return { ...EMPTY_SNAPSHOT };
      }
      return {
        actividades: Array.isArray(data.actividades) ? data.actividades : [],
        cuentasNegocio:
          data.cuentasNegocio && typeof data.cuentasNegocio === "object" ? data.cuentasNegocio : {},
        misInscripcionesIds: Array.isArray(data.misInscripcionesIds) ? data.misInscripcionesIds : [],
        updatedAt: data.updatedAt || null,
      };
    },

    saveSnapshot({ actividades, cuentasNegocio, misInscripcionesIds }) {
      const snapshot = {
        actividades: Array.isArray(actividades) ? actividades : [],
        cuentasNegocio:
          cuentasNegocio && typeof cuentasNegocio === "object" ? cuentasNegocio : {},
        misInscripcionesIds: Array.isArray(misInscripcionesIds) ? misInscripcionesIds : [],
        updatedAt: new Date().toISOString(),
      };
      storage.setJson(CACHE_SNAPSHOT_KEY, snapshot);
      return snapshot;
    },

    updateBusinessReviews(nombreNegocio, resenas) {
      const current = this.loadSnapshot();
      if (!current.cuentasNegocio[nombreNegocio]) return;
      current.cuentasNegocio[nombreNegocio] = {
        ...current.cuentasNegocio[nombreNegocio],
        resenas,
      };
      storage.setJson(CACHE_SNAPSHOT_KEY, current);
    },

    clear() {
      storage.remove(CACHE_SNAPSHOT_KEY);
    },
  };
}

export const cacheRepository = createCacheRepository();

