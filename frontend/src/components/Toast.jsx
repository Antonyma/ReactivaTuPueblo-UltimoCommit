import React from "react";
import { useApp } from "../context/AppContext.jsx";

export default function Toast() {
  const { toast } = useApp();

  if (!toast.open) return null;

  return (
    <div
      id="toast-alerta"
      className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md bg-blue-950 text-white p-4 rounded-2xl shadow-2xl border-2 border-amber-400 flex items-center gap-3 animate-bounce"
    >
      <span className="text-2xl">📲</span>
      <p id="toast-mensaje" className="text-sm font-bold leading-snug">
        {toast.mensaje}
      </p>
    </div>
  );
}
