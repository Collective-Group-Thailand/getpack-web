import { getTranslations } from "next-intl/server";

import { MobileBottomNav, SiteFooter, SiteHeader } from "@/features/customer/shell";
import { AppShell } from "@/ui/components/AppShell";

/**
 * Every storefront page shares one frame: header, footer and the phone bottom nav.
 *
 * A route group, so none of this appears in a URL. Two customer routes deliberately sit
 * *outside* it and keep the full viewport: `/design/[id]`, where the canvas is the product and
 * site chrome would compete with it (design-system.md §5 Designer), and `/sign-in`, which is a
 * single task with no navigation to offer.
 *
 * Putting the shell here rather than in each page is not only tidiness — a page that forgot it
 * would render with no header, no skip link and no landmarks, which is an accessibility
 * failure that looks like a styling bug.
 */
export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("common");

  return (
    <AppShell
      skipLabel={t("nav.skipToContent")}
      header={<SiteHeader />}
      footer={<SiteFooter />}
      bottomNav={<MobileBottomNav />}
      reserveBottomNavSpace
    >
      {children}
    </AppShell>
  );
}
