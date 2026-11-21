import React from "react";
import { useApp } from "../context/useApp.js";
import { IconBell } from "./Icons.jsx";

export default function Toast() {
  const { toast } = useApp();

  if (!toast.open) return null;

  return (
    <div
      id="toast-alerta"
      className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md bg-blue-950 text-white p-4 rounded-2xl shadow-2xl border-2 border-amber-400 flex items-center gap-3"
      role="status"
      aria-live="polite"
    >
      <IconBell className="w-6 h-6 text-amber-400 shrink-0" />
      <p id="toast-mensaje" className="text-sm font-bold leading-snug">
        {toast.mensaje}
      </p>
    </div>
  );
}
