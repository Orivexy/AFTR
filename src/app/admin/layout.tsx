import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSessionUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { Logo } from "@/components/layout/logo";
import { AdminNav } from "@/components/admin/admin-nav";
import { isAdmin, isStaff } from "@/lib/roles";

export const metadata: Metadata = { title: "Administración", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin");
  if (!isStaff(user.role)) redirect("/");
  const openReports = await db.report.count({ where: { status: "OPEN" } });

  return (
    <div className="mx-auto flex min-h-dvh max-w-7xl flex-col md:flex-row">
      <aside className="border-b border-line p-4 md:sticky md:top-0 md:h-dvh md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="mb-4 flex items-center justify-between md:mb-8">
          <Logo />
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-bold tracking-wider text-muted uppercase">{user.role === "ADMIN" ? "Admin" : "Mod"}</span>
        </div>
        <AdminNav openReports={openReports} isAdmin={isAdmin(user.role)} />
        <Link href="/" className="mt-4 hidden items-center gap-2 px-3 text-sm text-muted hover:text-fg md:flex">
          <ArrowLeft className="size-4" /> Volver a la app
        </Link>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
