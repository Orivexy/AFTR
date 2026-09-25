import { Star } from "lucide-react";
import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-xl", className)} aria-hidden />;
}

export function Chip({
  active,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "pressable inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold whitespace-nowrap",
        active ? "border-volt bg-volt text-on-volt" : "border-line-strong bg-surface text-fg hover:bg-surface-2",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: React.ReactNode; tone?: "neutral" | "volt" | "warn" | "danger" | "glass"; className?: string }) {
  const tones = {
    neutral: "bg-surface-3 text-muted",
    volt: "bg-volt text-on-volt",
    warn: "bg-warn/15 text-warn",
    danger: "bg-danger/15 text-danger",
    glass: "glass text-fg border border-line",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase", tones[tone], className)}>
      {children}
    </span>
  );
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge tone="glass" className={cn("!text-[10px] !text-muted", className)}>
      Demo
    </Badge>
  );
}

export function LiveDot({ className }: { className?: string }) {
  return <span className={cn("animate-pulse-dot inline-block size-2 rounded-full bg-volt", className)} aria-hidden />;
}

export function Stars({ value, size = 14, className }: { value: number; size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value.toFixed(1)} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i + 1));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star className="absolute inset-0 text-surface-3" fill="currentColor" strokeWidth={0} style={{ width: size, height: size }} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="text-volt" fill="currentColor" strokeWidth={0} style={{ width: size, height: size }} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-line-strong px-6 py-12 text-center">
      {icon && <div className="grid size-12 place-items-center rounded-full bg-surface-2 text-muted">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {children && <div className="max-w-xs text-sm text-muted">{children}</div>}
      {action}
    </div>
  );
}

export function SectionHeader({ title, action, className, eyebrow }: { title: string; action?: React.ReactNode; className?: string; eyebrow?: React.ReactNode }) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-4", className)}>
      <div>
        {eyebrow && <div className="mb-1 text-[11px] font-bold tracking-[0.14em] text-volt uppercase">{eyebrow}</div>}
        <h2 className="font-display text-[19px] font-semibold tracking-tight md:text-[22px]">{title}</h2>
      </div>
      {action}
    </div>
  );
}
