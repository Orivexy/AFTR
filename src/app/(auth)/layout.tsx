import { Logo } from "@/components/layout/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_20%_0%,rgb(123_44_255/0.28),transparent),radial-gradient(50%_40%_at_100%_100%,rgb(215_255_58/0.12),transparent)]" />
      <header className="relative flex h-16 items-center px-5 md:px-8">
        <Logo />
      </header>
      <main className="relative flex flex-1 items-start justify-center px-5 pt-6 pb-12 md:items-center md:pt-0">
        <div className="animate-fade-up w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
