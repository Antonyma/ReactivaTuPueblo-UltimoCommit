import { outboxRepository } from "./outboxRepository.js";
import { defaultSyncHandlers } from "./syncHandlers.js";

export function isNetworkFailure(err) {
  if (!err) return false;
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (err.isHttpError) return false;
  return err instanceof TypeError || /failed to fetch|network|load failed/i.test(err.message || "");
}

/**
 * Motor de sincronización secuencial FIFO (SRP + DIP + OCP).
 * Depende de abstracciones inyectadas (outbox + handlers) y separa errores
 * de red (reintento posterior) de errores de dominio 4xx (conflicto descartable).
 */
export function createSyncEngine({
  outbox = outboxRepository,
  handlers = defaultSyncHandlers,
} = {}) {
  let syncing = false;

  return {
    isSyncing() {
      return syncing;
    },

    async processQueue() {
      if (syncing) {
        return { skipped: true, syncedCount: 0, conflicts: [], remaining: outbox.count() };
      }

      const operations = outbox.getAll();
      if (operations.length === 0) {
        return { skipped: false, syncedCount: 0, conflicts: [], remaining: 0 };
      }

      syncing = true;
      let syncedCount = 0;
      const syncedLabels = [];
      const conflicts = [];
      const context = {
        tempBusinessIdMap: new Map(),
      };

      try {
        for (const operation of operations) {
          const handler = handlers[operation.type];
          if (!handler) {
            outbox.removeById(operation.id);
            continue;
          }

          try {
            const result = await handler(operation, context);
            outbox.removeById(operation.id);
            syncedCount += 1;
            if (result?.label) {
              syncedLabels.push(result.label);
            }
          } catch (err) {
            // Error de red o servidor 5xx: detener lote y mantener orden FIFO para reintentar
            if (isNetworkFailure(err) || (err.status && err.status >= 500)) {
              outbox.incrementRetry(operation.id);
              break;
            }

            // Error de dominio 4xx (p. ej. aforo lleno, duplicado, permisos): descartar y avisar
            outbox.removeById(operation.id);
            conflicts.push({
              operation,
              reason: err?.message || "Conflicto al sincronizar con el servidor",
            });
          }
        }
      } finally {
        syncing = false;
      }

      return {
        skipped: false,
        syncedCount,
        syncedLabels,
        conflicts,
        remaining: outbox.count(),
      };
    },
  };
}

export const defaultSyncEngine = createSyncEngine();

