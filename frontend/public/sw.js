const SHELL_CACHE = "pueblovivo-shell-v1";
const RUNTIME_CACHE = "pueblovivo-runtime-v1";
const MEDIA_CACHE = "pueblovivo-media-v1";

const APP_SHELL_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./favicon.svg",
  "./icons.svg",
];

const EXTERNAL_CDN_ORIGINS = [
  "https://cdn.tailwindcss.com",
  "https://unpkg.com",
];

const MEDIA_ORIGINS = [
  "https://tile.openstreetmap.org",
  "https://images.unsplash.com",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  const validCaches = new Set([SHELL_CACHE, RUNTIME_CACHE, MEDIA_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !validCaches.has(k)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response && (response.ok || response.type === "opaque")) {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    return cached;
  }

  const networkResponse = await networkPromise;
  if (networkResponse) {
    return networkResponse;
  }

  return new Response("Sin conexión", { status: 503, statusText: "Offline" });
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === "opaque")) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    return new Response("", { status: 503, statusText: "Offline" });
  }
}

async function networkFirstWithShellFallback(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const indexFallback = await cache.match("./index.html");
    if (indexFallback) return indexFallback;
    return new Response("Aplicación sin conexión", { status: 503 });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Navegación SPA (HTML): Network-First con fallback a index.html cacheado
  if (request.mode === "navigate") {
    event.respondWith(networkFirstWithShellFallback(request));
    return;
  }

  // Llamadas a la API local o remota: dejar que la capa de datos (AppContext + cacheRepository) gestione el fallback
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Tiles de OpenStreetMap e imágenes externas: Cache-First
  if (MEDIA_ORIGINS.some((origin) => url.origin === origin) || request.destination === "image") {
    event.respondWith(cacheFirst(request, MEDIA_CACHE));
    return;
  }

  // CDNs externos (Tailwind, Leaflet): Stale-While-Revalidate
  if (EXTERNAL_CDN_ORIGINS.some((origin) => url.origin === origin)) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    return;
  }

  // Assets estáticos del mismo origen (JS, CSS, fuentes, SVGs): Stale-While-Revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
  }
});

