"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/providers/toast-provider";
import { api, ApiClientError } from "@/lib/api-client";
import { cn } from "@/lib/cn";

interface Props {
  url: string;
  method?: "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  confirm?: string;
  children: React.ReactNode;
  tone?: "default" | "danger" | "primary";
  success?: string;
}

/** Small button that performs an admin API call and refreshes the page. */
export function AdminAction({ url, method = "PATCH", body, confirm: confirmText, children, tone = "default", success = "Hecho" }: Props) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const run = async () => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    try {
      if (method === "DELETE") await api.del(url);
      else if (method === "POST") await api.post(url, body);
      else if (method === "PUT") await api.put(url, body);
      else await api.patch(url, body);
      toast(success);
      router.refresh();
    } catch (err) {
      toast((err as ApiClientError).message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      onClick={run}
      disabled={busy}
      className={cn(
        "pressable inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-bold whitespace-nowrap disabled:opacity-50",
        tone === "danger" ? "bg-danger/15 text-danger hover:bg-danger/25" : tone === "primary" ? "bg-volt text-on-volt" : "bg-surface-3 hover:bg-line-strong",
      )}
    >
      {busy && <Loader2 className="size-3 animate-spin" />}
      {children}
    </button>
  );
}
