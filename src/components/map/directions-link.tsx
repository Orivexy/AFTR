"use client";

import { useEffect, useState } from "react";
import { directionsUrl } from "@/lib/map-filters";

/** "Cómo llegar": opens the device's own maps app (Apple Maps, Android geo:, Google Maps on the web). */
export function DirectionsLink({ lat, lng, name, className, children }: { lat: number; lng: number; name?: string; className?: string; children: React.ReactNode }) {
  const [ua, setUa] = useState("");
  useEffect(() => setUa(navigator.userAgent), []); // eslint-disable-line react-hooks/set-state-in-effect -- device-specific link after mount
  return (
    <a href={directionsUrl({ lat, lng, name }, ua)} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}
