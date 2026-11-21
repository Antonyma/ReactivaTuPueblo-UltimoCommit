import { OUTBOX_ACTION_TYPES } from "./outboxRepository.js";
import { parseCoords } from "../../api/mappers.js";
import {
  TIPO_EVENTO_A_CATEGORIA,
  formatearFechaBonita,
} from "../../constants/comarca.js";

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=800&q=80";

/**
 * Proyector puro del estado offline (SRP + OCP).
 * Aplica las operaciones pendientes de la cola Outbox sobre el snapshot cacheado
 * para que los cambios creados sin conexión sobrevivan a recargas (F5) hasta sincronizarse.
 */
export function applyOutboxProjection(baseState, operations, usuarioActual) {
  let actividades = [...(baseState.actividades || [])];
  const cuentasNegocio = { ...(baseState.cuentasNegocio || {}) };
  let misInscripcionesIds = [...(baseState.misInscripcionesIds || [])];
  const inscripcionesPendientesSet = new Set();

  for (const op of operations || []) {
    switch (op.type) {
      case OUTBOX_ACTION_TYPES.CREAR_NEGOCIO: {
        const p = op.payload;
        cuentasNegocio[p.nombre] = {
          id: op.tempId,
          nombre: p.nombre,
          esMio: true,
          propietarioId: usuarioActual?.id ? Number(usuarioActual.id) : null,
          pueblo: p.pueblo || "Lucainena de las Torres",
          coordenadas: p.coordenadas || "",
          telefonoPublicador: usuarioActual?.telefono || "+34600112233",
          actividadesAprobadas: 0,
          cuentaVerificada: false,
          fiabilidad: 0,
          pendiente: true,
          pendienteSync: true,
          propietarioNombre: usuarioActual?.nombre || "",
          instagramUrl: p.instagramUrl || "",
          facebookUrl: p.facebookUrl || "",
          twitterUrl: p.twitterUrl || "",
          webUrl: p.webUrl || "",
          resenas: [],
        };
        break;
      }

      case OUTBOX_ACTION_TYPES.ACTUALIZAR_NEGOCIO: {
        const p = op.payload;
        const nombreAnterior = op.meta?.nombreAnterior || p.nombre;
        const existente = cuentasNegocio[nombreAnterior] || cuentasNegocio[p.nombre];
        if (existente) {
          if (nombreAnterior !== p.nombre) {
            delete cuentasNegocio[nombreAnterior];
            actividades = actividades.map((a) =>
              a.negocio === nombreAnterior ? { ...a, negocio: p.nombre } : a
            );
          }
          cuentasNegocio[p.nombre] = {
            ...existente,
            nombre: p.nombre,
            pueblo: p.pueblo,
            coordenadas: p.coordenadas,
            instagramUrl: p.instagramUrl || "",
            facebookUrl: p.facebookUrl || "",
            twitterUrl: p.twitterUrl || "",
            webUrl: p.webUrl || "",
            pendienteSync: true,
          };
        }
        break;
      }

      case OUTBOX_ACTION_TYPES.PUBLICAR_EVENTO: {
        const p = op.payload;
        const nuevoEvento = {
          id: op.tempId,
          nombre: p.nombre,
          pueblo: p.pueblo,
          negocio: op.meta?.negocioNombre || "Organizador local",
          negocioId: p.negocioId,
          categoria: TIPO_EVENTO_A_CATEGORIA[Number(p.tipoEvento)] || "Cultura",
          tipoEvento: Number(p.tipoEvento || 1),
          descripcion: p.descripcion || "",
          coords: parseCoords(p.coordenadas, p.pueblo),
          dePago: Boolean(p.dePago),
          asistentes: 0,
          aforo: Number(p.aforo ?? 0),
          listaInscritos: [],
          fechaInicioISO: p.fechaInicio,
          fechaFinISO: p.fechaFin,
          fecha: formatearFechaBonita(p.fechaInicio),
          estadoModeracion: "pendiente",
          ahorroTokens: false,
          motivoIA: "Pendiente de sincronizar con el servidor",
          imagen: p.imagen || DEFAULT_IMAGE,
          pendienteSync: true,
        };
        if (!actividades.some((a) => a.id === nuevoEvento.id)) {
          actividades = [nuevoEvento, ...actividades];
        }
        break;
      }

      case OUTBOX_ACTION_TYPES.INSCRIBIRSE_EVENTO: {
        const id = op.payload.eventoId;
        inscripcionesPendientesSet.add(id);
        if (!misInscripcionesIds.includes(id)) {
          misInscripcionesIds.push(id);
          actividades = actividades.map((a) =>
            a.id === id ? { ...a, asistentes: a.asistentes + 1 } : a
          );
        }
        break;
      }

      case OUTBOX_ACTION_TYPES.DESAPUNTARSE_EVENTO: {
        const id = op.payload.eventoId;
        inscripcionesPendientesSet.add(id);
        if (misInscripcionesIds.includes(id)) {
          misInscripcionesIds = misInscripcionesIds.filter((i) => i !== id);
          actividades = actividades.map((a) =>
            a.id === id ? { ...a, asistentes: Math.max(0, a.asistentes - 1) } : a
          );
        }
        break;
      }

      case OUTBOX_ACTION_TYPES.CREAR_VALORACION: {
        const nombreNegocio = op.meta?.nombreNegocio;
        if (nombreNegocio && cuentasNegocio[nombreNegocio]) {
          const actual = cuentasNegocio[nombreNegocio];
          const resenaTemp = {
            id: op.id,
            usuario: usuarioActual?.nombre || "Vecino",
            estrellas: op.payload.estrellas,
            texto: op.payload.texto,
            pendienteSync: true,
          };
          const prevResenas = actual.resenas || [];
          if (!prevResenas.some((r) => r.id === resenaTemp.id)) {
            cuentasNegocio[nombreNegocio] = {
              ...actual,
              resenas: [resenaTemp, ...prevResenas],
            };
          }
        }
        break;
      }

      default:
        break;
    }
  }

  return {
    actividades,
    cuentasNegocio,
    misInscripcionesIds,
    inscripcionesPendientesIds: Array.from(inscripcionesPendientesSet),
  };
}

