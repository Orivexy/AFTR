import { forwardRef } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-2xl border border-line-strong bg-surface-2 px-4 text-[15px] text-fg placeholder:text-faint transition-colors outline-none focus:border-volt/70 focus:bg-surface-3 aria-[invalid=true]:border-danger";

export function Field({ label, error, hint, children, htmlFor, className }: { label?: string; error?: string; hint?: string; children: React.ReactNode; htmlFor?: string; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label htmlFor={htmlFor} className="block text-[13px] font-semibold text-muted">
          {label}
        </label>
      )}
      {children}
      {error ? <p className="text-[13px] text-danger">{error}</p> : hint ? <p className="text-[12px] text-faint">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(control, "h-12", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(control, "min-h-28 resize-y py-3", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...props }, ref) {
  return <select ref={ref} className={cn(control, "h-12 appearance-none", className)} {...props} />;
});
