"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

export function AdminSearch({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const q = new FormData(e.currentTarget).get("q")?.toString().trim() ?? "";
        const next = new URLSearchParams(params.toString());
        if (q) next.set("q", q);
        else next.delete("q");
        next.delete("cursor");
        router.push(`${pathname}?${next}`);
      }}
      className="relative max-w-sm flex-1"
    >
      <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
      <input name="q" defaultValue={params.get("q") ?? ""} placeholder={placeholder} className="h-10 w-full rounded-full border border-line-strong bg-surface pr-4 pl-10 text-sm outline-none focus:border-volt/60" />
    </form>
  );
}
