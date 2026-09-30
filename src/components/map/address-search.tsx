"use client";

import { useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";

export interface AddressResult {
  label: string;
  lat: number;
  lng: number;
}

/**
 * Looks up an address (OpenStreetMap Nominatim through /api/geocode) and
 * places the pin there. Searching only on submit keeps within the service's
 * fair-use policy (no search-as-you-type).
 */
export function AddressSearch({ citySlug, onPick, placeholder = "Buscar una dirección…" }: { citySlug?: string; onPick: (r: AddressResult) => void; placeholder?: string }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<AddressResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    if (q.trim().length < 3) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ q: q.trim(), ...(citySlug ? { city: citySlug } : {}) });
      const res = await api.get<{ results: AddressResult[] }>(`/api/geocode?${qs}`);
      setResults(res.results);
    } catch (err) {
      setResults(null);
      setError((err as ApiClientError).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search();
            }
          }}
          placeholder={placeholder}
          aria-label="Buscar dirección"
          maxLength={120}
          className="h-11 min-w-0 flex-1 rounded-2xl border border-line-strong bg-surface-2 px-4 text-[15px] outline-none placeholder:text-faint focus:border-fg"
        />
        <button type="button" onClick={search} disabled={loading || q.trim().length < 3} aria-label="Buscar" className="pressable grid size-11 shrink-0 place-items-center rounded-2xl bg-surface-2 hover:bg-surface-3 disabled:opacity-50">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
        </button>
      </div>
      {error && <p className="text-[13px] text-warn">{error}</p>}
      {results && results.length === 0 && <p className="text-[13px] text-muted">No encontramos esa dirección. Prueba con calle y número, o toca el mapa.</p>}
      {results && results.length > 0 && (
        <ul className="overflow-hidden rounded-2xl border border-line bg-surface">
          {results.map((r) => (
            <li key={`${r.lat},${r.lng}`}>
              <button
                type="button"
                onClick={() => {
                  onPick(r);
                  setResults(null);
                  setQ("");
                }}
                className="flex w-full items-start gap-2 px-4 py-2.5 text-left text-[13px] hover:bg-surface-2"
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-volt" />
                <span className="min-w-0">{r.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-faint">Direcciones: © OpenStreetMap contributors</p>
    </div>
  );
}
