import type { Metadata, Viewport } from "next";
import "./globals.css";
import { site } from "@/config/site";
import { getSessionUser } from "@/server/auth/session";
import { SessionProvider, type ClientUser } from "@/components/providers/session-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { LocationProvider } from "@/components/providers/location-provider";
import { AuthGateProvider } from "@/components/providers/auth-gate";
import { SavedEventsProvider } from "@/components/providers/saved-events-provider";
import { env } from "@/server/env";

export const metadata: Metadata = {
  metadataBase: new URL(env.APP_URL),
  title: { default: `${site.name} · ${site.tagline}`, template: `%s · ${site.name}` },
  description: site.description,
  applicationName: site.name,
  openGraph: { siteName: site.name, type: "website", locale: "es_ES" },
  appleWebApp: { capable: true, title: site.name, statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/favicon-32.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#07070b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionUser();
  const user: ClientUser | null = session
    ? { id: session.id, username: session.username, displayName: session.displayName, avatarKey: session.avatarKey, role: session.role }
    : null;

  return (
    <html lang="es">
      <body>
        <SessionProvider user={user}>
          <ToastProvider>
            <LocationProvider>
              <AuthGateProvider>
                <SavedEventsProvider>{children}</SavedEventsProvider>
              </AuthGateProvider>
            </LocationProvider>
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
