import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo />
      <div>
        <p className="font-display text-6xl font-bold text-volt">404</p>
        <p className="mt-2 text-muted">Esta página se fue antes de que llegaras.</p>
      </div>
      <Link href="/" className={buttonClass("primary", "lg")}>
        Volver al inicio
      </Link>
    </div>
  );
}
