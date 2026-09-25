"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { LatLng } from "@/lib/geo";

/**
 * Device location, strictly opt-in: we only call the Geolocation API after
 * the user taps "use my location", and remember the choice for the session.
 */
type Status = "idle" | "locating" | "granted" | "denied" | "unavailable";

interface LocationState {
  coords: LatLng | null;
  status: Status;
  request: () => void;
  clear: () => void;
}

const LocationContext = createContext<LocationState>({ coords: null, status: "idle", request: () => {}, clear: () => {} });
const KEY = "nightly:coords";

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  // Restore after mount (not in the initial state) so server and client HTML match.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(KEY);
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from browser storage
        setCoords(JSON.parse(saved) as LatLng);
        setStatus("granted");
      }
    } catch {
      /* storage unavailable */
    }
  }, []);

  const request = useCallback(() => {
    if (!("geolocation" in navigator)) return setStatus("unavailable");
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c);
        setStatus("granted");
        try {
          sessionStorage.setItem(KEY, JSON.stringify(c));
        } catch {
          /* ignore */
        }
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }, []);

  const clear = useCallback(() => {
    setCoords(null);
    setStatus("idle");
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return <LocationContext.Provider value={{ coords, status, request, clear }}>{children}</LocationContext.Provider>;
}

export function useLocation() {
  return useContext(LocationContext);
}
