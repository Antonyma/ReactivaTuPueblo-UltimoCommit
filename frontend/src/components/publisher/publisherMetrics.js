import { esEventoFinalizado } from "../../utils/eventUtils.js";

/**
 * Calcula métricas agregadas reales a partir de una lista de eventos.
 * Responsabilidad única: agregación pura sin acoplamiento a UI.
 */
export function calcularMetricasEventos(eventos = [], ahoraMs = Date.now()) {
  const lista = Array.isArray(eventos) ? eventos : [];

  let activos = 0;
  let finalizados = 0;
  let pendientes = 0;
  let totalInscritos = 0;
  let totalAforo = 0;
  let sumaPonderadaEstrellas = 0;
  let totalValoraciones = 0;
  let eventoDestacado = null;

  for (const act of lista) {
    const asistentes = Number(act.asistentes ?? 0);
    const aforo = Number(act.aforo ?? 0);
    const finalizado = esEventoFinalizado(act, ahoraMs);

    if (finalizado) {
      finalizados += 1;
    } else if (act.estadoModeracion === "aprobada") {
      activos += 1;
    } else if (
      act.estadoModeracion === "pendiente" ||
      act.estadoModeracion === "pendiente_confirmacion"
    ) {
      pendientes += 1;
    }

    totalInscritos += asistentes;
    if (aforo > 0) {
      totalAforo += aforo;
    }

    const numVal = Number(act.totalValoraciones ?? 0);
    if (numVal > 0 && act.mediaEstrellas !== null && act.mediaEstrellas !== undefined) {
      sumaPonderadaEstrellas += Number(act.mediaEstrellas) * numVal;
      totalValoraciones += numVal;
    }

    if (asistentes > 0 && (!eventoDestacado || asistentes > eventoDestacado.asistentes)) {
      eventoDestacado = {
        id: act.id,
        nombre: act.nombre,
        asistentes,
        aforo,
      };
    }
  }

  const ocupacionMedia =
    totalAforo > 0 ? Math.min(100, Math.round((totalInscritos / totalAforo) * 100)) : 0;
  const valoracionMedia =
    totalValoraciones > 0 ? Number((sumaPonderadaEstrellas / totalValoraciones).toFixed(1)) : null;

  return {
    totalEventos: lista.length,
    activos,
    finalizados,
    pendientes,
    totalInscritos,
    totalAforo,
    ocupacionMedia,
    valoracionMedia,
    totalValoraciones,
    eventoDestacado,
  };
}

