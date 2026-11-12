import type { Metadata, Viewport } from "next";
import { getLocale } from "next-intl/server";

import { RegisterAgentWorker } from "@/features/agent/pwa/RegisterAgentWorker";
import { ZoneProviders } from "@/features/shared/zone";
import { AGENT_APP_COLOURS } from "@/lib/pwa/manifest";
import { BRAND_NAME } from "@/ui/brand";
import { fontClassNames } from "@/ui/fonts";
import "../globals.css";

const APP_NAME = `${BRAND_NAME} Agent`;

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s — ${APP_NAME}` },
  applicationName: APP_NAME,
  // Belt and braces behind the proxy's `X-Robots-Tag` and the 404 for /robots.txt: never indexed (D-467).
  robots: { index: false, follow: false, nocache: true },
  // iOS has no install prompt; "Add to Home Screen" reads these (and web push on iOS needs the installed app).
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
  icons: { apple: [{ url: "/agent-app/apple-touch-icon.png", sizes: "180x180" }] },
};

export const viewport: Viewport = {
  themeColor: AGENT_APP_COLOURS.theme,
  // `cover`, so the safe-area insets every fixed bar pads itself by are real numbers on a notched phone.
  viewportFit: "cover",
  colorScheme: "light",
};

/**
 * getpack Agent's root layout (D-467). Like every zone, its own `<html>`, providers and fonts, so agent code never
 * ships to the storefront and back. Light only — the agent zone has no dark surfaces (agent portal pack) — and the
 * language comes from the host-only `pk_locale` cookie, as on the other tool zones.
 */
export default async function AgentZoneLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} data-theme="light" data-zone="agent" className={fontClassNames}>
      <body>
        <ZoneProviders zone="agent" themeChoice="light">
          {children}
          <RegisterAgentWorker />
        </ZoneProviders>
      </body>
    </html>
  );
}
