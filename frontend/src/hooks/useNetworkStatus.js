import { useState, useEffect, useCallback } from "react";
import { isSimulatedOffline, setSimulatedOffline } from "../services/offline/networkSimulation.js";

/**
 * Hook dedicado al estado de red y a la instalación de la PWA (SRP).
 */
export function useNetworkStatus() {
  const [browserOnline, setBrowserOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [modoOfflineSimulado, setModoOfflineSimulado] = useState(() => isSimulatedOffline());
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [appInstalada, setAppInstalada] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(display-mode: standalone)")?.matches || false;
  });

  useEffect(() => {
    const handleOnline = () => setBrowserOnline(true);
    const handleOffline = () => setBrowserOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setInstallPromptEvent(e);
    };

    const handleAppInstalled = () => {
      setAppInstalada(true);
      setInstallPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const toggleModoOfflineSimulado = useCallback(() => {
    setModoOfflineSimulado((prev) => {
      const next = !prev;
      setSimulatedOffline(next);
      return next;
    });
  }, []);

  const instalarPwa = useCallback(async () => {
    if (!installPromptEvent) return false;
    installPromptEvent.prompt();
    const choice = await installPromptEvent.userChoice.catch(() => null);
    if (choice?.outcome === "accepted") {
      setInstallPromptEvent(null);
      return true;
    }
    return false;
  }, [installPromptEvent]);

  const isOnline = browserOnline && !modoOfflineSimulado;

  return {
    browserOnline,
    isOnline,
    modoOfflineSimulado,
    toggleModoOfflineSimulado,
    puedeInstalarPwa: Boolean(installPromptEvent) && !appInstalada,
    appInstalada,
    instalarPwa,
  };
}

