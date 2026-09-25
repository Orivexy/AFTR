"use client";

import { useEffect, useState } from "react";
import { AtSign, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { api } from "@/lib/api-client";

interface Found {
  id: string;
  username: string;
  displayName: string;
  avatarKey: string | null;
}

export function UserTagger({ value, onChange, max = 10 }: { value: Found[]; onChange: (v: Found[]) => void; max?: number }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Found[]>([]);

  const term = q.replace(/^@/, "").trim();
  useEffect(() => {
    if (!term) return;
    const t = setTimeout(() => {
      api
        .get<{ items: Found[] }>(`/api/users/lookup?q=${encodeURIComponent(term)}`)
        .then((r) => setResults(r.items.filter((u) => !value.some((v) => v.id === u.id))))
        .catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(t);
  }, [term, value]);

  return (
    <div className="space-y-2">
      <div className="relative flex flex-wrap items-center gap-2 rounded-2xl border border-line-strong bg-surface-2 px-3 py-2.5">
        <AtSign className="ml-1 size-4 text-muted" />
        {value.map((u) => (
          <span key={u.id} className="flex items-center gap-1.5 rounded-full bg-surface-3 py-1 pr-1.5 pl-1 text-[13px] font-semibold">
            <Avatar user={u} size={20} /> @{u.username}
            <button type="button" aria-label={`Quitar a ${u.username}`} onClick={() => onChange(value.filter((v) => v.id !== u.id))} className="grid size-5 place-items-center rounded-full hover:bg-surface-2">
              <X className="size-3" />
            </button>
          </span>
        ))}
        {value.length < max && (
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={value.length ? "" : "Etiquetar personas"} aria-label="Etiquetar personas" className="h-8 min-w-32 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint" />
        )}
      </div>
      {term && results.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface-2">
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                onChange([...value, u]);
                setQ("");
              }}
              className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-3"
            >
              <Avatar user={u} size={30} />
              <span className="text-sm">
                <b>{u.displayName}</b> <span className="text-muted">@{u.username}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
