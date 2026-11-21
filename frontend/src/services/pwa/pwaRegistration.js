/**
 * Responsabilidad única (SRP): Registro del Service Worker y gestión de eventos PWA.
 */

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    const baseUrl = import.meta.env?.BASE_URL || "/";
    const swUrl = `${baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`}sw.js`;
    navigator.serviceWorker.register(swUrl).catch((err) => {
      console.warn("[PWA] No se pudo registrar el Service Worker:", err);
    });
  });
}

