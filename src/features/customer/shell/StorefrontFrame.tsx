import { getTranslations } from "next-intl/server";

import { AgentLinkClaim } from "@/features/customer/agent/AgentLinkClaim";
import { FunnelPageView } from "@/features/customer/analytics/FunnelPageView";
import { JsonLd } from "@/features/customer/seo/JsonLd";
import { publicOrigin, webSiteSchema } from "@/lib/seo";
import { AppShell } from "@/ui/components/AppShell";

import { ConsentBanner } from "./ConsentBanner";
import { GoogleTagManager } from "./GoogleTagManager";
import { MobileBottomNav } from "./MobileBottomNav";
import { OrganizationJsonLd } from "./OrganizationJsonLd";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

/**
 * The storefront's frame: header, footer, the phone bottom nav, the tag manager and the site's JSON-LD.
 *
 * The `(storefront)` route group's layout is this and nothing else. It is a component rather than living only in that
 * layout because one route outside the group needs it too: `/l/[token]`, whose own layout picks this frame for a
 * notification link and a bare one for a driver's handover link (`HandoverFrame`).
 *
 * Putting the shell in a layout rather than in each page is not only tidiness — a page that forgot it would render
 * with no header, no skip link and no landmarks, which is an accessibility failure that looks like a styling bug.
 */
export async function StorefrontFrame({ locale, children }: { locale: string; children: React.ReactNode }) {
  const [t, origin] = await Promise.all([getTranslations("common"), publicOrigin()]);

  return (
    <AppShell
      skipLabel={t("nav.skipToContent")}
      header={<SiteHeader />}
      footer={<SiteFooter />}
      bottomNav={<MobileBottomNav />}
      reserveBottomNavSpace
    >
      <GoogleTagManager />
      <FunnelPageView />
      <AgentLinkClaim />
      <OrganizationJsonLd origin={origin} />
      <JsonLd data={webSiteSchema(origin, locale)} />
      {children}
      {/* The guided-help launcher waits for the Structure Advisor (U2.2, D-223). */}
      <ConsentBanner />
    </AppShell>
  );
}
