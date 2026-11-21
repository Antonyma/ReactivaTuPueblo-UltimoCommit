import { defaultStorageAdapter } from "./storageAdapter.js";

const OUTBOX_STORAGE_KEY = "pueblovivo_offline_outbox_v1";

export const OUTBOX_ACTION_TYPES = Object.freeze({
  CREAR_NEGOCIO: "CREAR_NEGOCIO",
  ACTUALIZAR_NEGOCIO: "ACTUALIZAR_NEGOCIO",
  PUBLICAR_EVENTO: "PUBLICAR_EVENTO",
  INSCRIBIRSE_EVENTO: "INSCRIBIRSE_EVENTO",
  DESAPUNTARSE_EVENTO: "DESAPUNTARSE_EVENTO",
  CREAR_VALORACION: "CREAR_VALORACION",
});

function generateOperationId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Repositorio de cola de salida (Outbox Pattern) (SRP + DIP).
 * Mantiene una cola FIFO persistente de mutaciones creadas sin conexión.
 */
export function createOutboxRepository(storage = defaultStorageAdapter) {
  const readAll = () => {
    const items = storage.getJson(OUTBOX_STORAGE_KEY, []);
    return Array.isArray(items) ? items : [];
  };

  const writeAll = (items) => {
    storage.setJson(OUTBOX_STORAGE_KEY, items);
    return items;
  };

  return {
    getAll() {
      return readAll();
    },

    count() {
      return readAll().length;
    },

    enqueue({ type, payload, meta = {}, tempId = null }) {
      const items = readAll();
      const operation = {
        id: generateOperationId(),
        type,
        payload,
        meta,
        tempId,
        createdAt: new Date().toISOString(),
        retries: 0,
      };
      items.push(operation);
      writeAll(items);
      return operation;
    },

    removeById(operationId) {
      const next = readAll().filter((op) => op.id !== operationId);
      writeAll(next);
      return next;
    },

    incrementRetry(operationId) {
      const next = readAll().map((op) =>
        op.id === operationId ? { ...op, retries: (op.retries || 0) + 1 } : op
      );
      writeAll(next);
      return next;
    },

    clear() {
      storage.remove(OUTBOX_STORAGE_KEY);
    },
  };
}

export const outboxRepository = createOutboxRepository();

