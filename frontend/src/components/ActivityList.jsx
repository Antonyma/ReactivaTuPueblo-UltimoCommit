import React from "react";
import { useApp } from "../context/AppContext.jsx";
import ActivityCard from "./ActivityCard.jsx";

export default function ActivityList() {
  const { actividades, puebloActivo, usuario } = useApp();

  const esPublicador = usuario && usuario.tipoUsuario === "PUBLICADOR";

  const lista = actividades.filter((a) => {
    if (a.estadoModeracion === "denegada") return false;
    if (a.estadoModeracion === "pendiente" && !esPublicador) return false;
    return puebloActivo === "Todos" || a.pueblo === puebloActivo;
  });

  if (lista.length === 0) {
    return (
      <div className="bg-white p-8 rounded-3xl text-center border-2 border-blue-300">
        <p className="text-lg font-bold">No hay actividades en este pueblo ahora mismo.</p>
        <p className="text-sm text-stone-600 mt-1">Pulsa "Todos" arriba para ver los planes de toda la comarca.</p>
      </div>
    );
  }

  return (
    <div id="grid-actividades" className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {lista.map((act) => (
        <ActivityCard key={act.id} act={act} />
      ))}
    </div>
  );
}
