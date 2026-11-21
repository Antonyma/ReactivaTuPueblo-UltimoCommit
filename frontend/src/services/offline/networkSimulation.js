/**
 * Fuente única de verdad para el estado de simulación sin cobertura (SRP).
 */

const SIMULATED_OFFLINE_KEY = "pueblovivo_simulated_offline";

export function isSimulatedOffline() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SIMULATED_OFFLINE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setSimulatedOffline(enabled) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SIMULATED_OFFLINE_KEY, String(Boolean(enabled)));
  } catch {
    // ignore storage errors
  }
}

export function isEffectivelyOffline() {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return true;
  }
  return isSimulatedOffline();
}

