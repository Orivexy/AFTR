"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { cn } from "@/lib/cn";

/** Unread badge; refreshes on navigation and every minute while visible. */
export function NotificationBell({ className }: { className?: string }) {
  const [count, setCount] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/notifications/unread")
        .then((r) => (r.ok ? r.json() : { count: 0 }))
        .then((d: { count: number }) => !cancelled && setCount(d.count))
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pathname]);

  return (
    <Link href="/notifications" aria-label={`Notificaciones${count ? ` (${count} sin leer)` : ""}`} className={cn("pressable relative grid size-10 place-items-center rounded-full hover:bg-surface-2", className)}>
      <Bell className="size-[21px]" />
      {count > 0 && (
        <span className="absolute top-1.5 right-1.5 grid min-w-4 place-items-center rounded-full bg-volt px-1 text-[10px] leading-4 font-bold text-on-volt">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
