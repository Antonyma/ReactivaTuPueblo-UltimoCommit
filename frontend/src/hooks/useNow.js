import { useEffect, useState } from "react";

/**
 * Devuelve un timestamp reactivo actualizado periódicamente.
 * Evita llamar a Date.now() directamente durante el render (regla react/purity).
 */
export function useNow(intervalMs = 60000) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return nowMs;
}

