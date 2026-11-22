import { eventosApi, negociosApi } from "../../api/client.js";
import { OUTBOX_ACTION_TYPES } from "./outboxRepository.js";

/**
 * Estrategias de sincronización por tipo de acción (OCP + SRP).
 * Añadir una nueva operación offline solo requiere registrar una nueva entrada aquí,
 * sin modificar el motor de sincronización (syncEngine.js).
 */
export function createSyncHandlers({
  eventos = eventosApi,
  negocios = negociosApi,
} = {}) {
  return {
    [OUTBOX_ACTION_TYPES.CREAR_NEGOCIO]: async (operation, context) => {
      const res = await negocios.crear(operation.payload);
      const realId = res?.data?.id ? Number(res.data.id) : null;
      if (operation.tempId && realId) {
        context.tempBusinessIdMap.set(operation.tempId, realId);
      }
      return {
        label: `Comercio "${operation.payload.nombre}" sincronizado`,
        data: res?.data,
      };
    },

    [OUTBOX_ACTION_TYPES.ACTUALIZAR_NEGOCIO]: async (operation, context) => {
      const resolvedId = context.tempBusinessIdMap.get(operation.payload.id) || operation.payload.id;
      const { id: _ignored, ...body } = operation.payload;
      const res = await negocios.actualizar(resolvedId, body);
      return {
        label: `Cambios en "${body.nombre}" sincronizados`,
        data: res?.data,
      };
    },

    [OUTBOX_ACTION_TYPES.PUBLICAR_EVENTO]: async (operation, context) => {
      const resolvedNegocioId =
        context.tempBusinessIdMap.get(operation.payload.negocioId) || operation.payload.negocioId;
      const res = await eventos.crear({
        ...operation.payload,
        negocioId: resolvedNegocioId,
        creadoOffline: true,
      });
      return {
        label: `Evento "${operation.payload.nombre}" enviado a revisión del moderador`,
        data: res?.data,
      };
    },

    [OUTBOX_ACTION_TYPES.INSCRIBIRSE_EVENTO]: async (operation) => {
      await eventos.inscribirse(operation.payload.eventoId);
      return {
        label: `Inscripción a "${operation.meta?.eventoNombre || "actividad"}" confirmada`,
      };
    },

    [OUTBOX_ACTION_TYPES.DESAPUNTARSE_EVENTO]: async (operation) => {
      await eventos.desapuntarse(operation.payload.eventoId);
      return {
        label: `Baja de "${operation.meta?.eventoNombre || "actividad"}" confirmada`,
      };
    },

    [OUTBOX_ACTION_TYPES.CREAR_VALORACION]: async (operation) => {
      const { eventoId, estrellas, texto } = operation.payload;
      await eventos.crearValoracion(eventoId, { estrellas, texto });
      return {
        label: `Opinión sobre "${operation.meta?.nombreNegocio || "comercio"}" enviada`,
      };
    },
  };
}

export const defaultSyncHandlers = createSyncHandlers();

