import React, { useEffect, useState, useCallback } from "react";
import { useApp } from "../../context/useApp.js";
import { eventosApi } from "../../api/client.js";
import BaseModal from "./BaseModal.jsx";

function AttendeesList({ act }) {
  const [estado, setEstado] = useState({ cargando: true, inscritos: [] });

  useEffect(() => {
    let active = true;
    eventosApi
      .verInscritos(act.id)
      .then((res) => {
        if (!active) return;
        const lista = (res?.data?.inscritos || []).map((item) => ({
          nombre: item.usuario?.nombre || "Vecino",
          email: item.usuario?.email || "",
          telefono: item.usuario?.telefono || "",
        }));
        setEstado({ cargando: false, inscritos: lista });
      })
      .catch(() => {
        if (!active) return;
        setEstado({ cargando: false, inscritos: act.listaInscritos || [] });
      });

    return () => {
      active = false;
    };
  }, [act]);

  if (estado.cargando) {
    return <p className="text-stone-500 text-center py-4">Cargando inscritos...</p>;
  }

  if (estado.inscritos.length === 0) {
    return <p className="text-stone-500 text-center py-4">Aún no hay nadie apuntado.</p>;
  }

  return (
    <div className="space-y-2 text-sm">
      {estado.inscritos.map((p, i) => (
        <div key={`${p.email || p.nombre}-${i}`} className="p-3 bg-blue-50 rounded-xl border border-blue-200">
          <b className="text-blue-950">
            {i + 1}. {p.nombre}
          </b>
          <div className="text-xs text-stone-600 mt-0.5 break-all">
            {p.email}
            {p.telefono ? ` · ${p.telefono}` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AttendeesModal() {
  const { modalInscritos, setModalInscritos } = useApp();
  const act = modalInscritos.actividad;

  const cerrarModal = useCallback(() => {
    setModalInscritos({ open: false, actividad: null });
  }, [setModalInscritos]);

  return (
    <BaseModal
      open={Boolean(modalInscritos.open && act)}
      onClose={cerrarModal}
      title="Personas Apuntadas"
      subtitle={act ? `${act.nombre} (${act.asistentes} de ${act.aforo})` : null}
      maxWidthClass="max-w-md"
      containerClassName="bg-white text-stone-900 rounded-3xl w-full max-h-[90vh] overflow-y-auto p-5 shadow-2xl border-2 border-blue-700 space-y-4"
    >
      {act && <AttendeesList key={act.id} act={act} />}
    </BaseModal>
  );
}
