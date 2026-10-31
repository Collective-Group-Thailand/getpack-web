import { getTranslations } from "next-intl/server";

import { BrandLogo } from "@/ui/brand";

/**
 * The frame of a driver's handover link `/l/d…` (D-463): the getpack logo and the page, nothing else.
 *
 * The driver is not a customer: the storefront's navigation, cart, phone tab bar and footer are links they have no
 * use for, and the tab bar would sit on top of the sticky "confirm pickup" bar. No tag manager or page-view beacon
 * either — the URL carries the link's token. The logo is not a link, so nothing leads the driver away mid-pickup.
 */
export async function HandoverFrame({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("common");
  return (
    <div className="bg-bg flex min-h-dvh flex-col">
      <a href="#main" className="skip-link">
        {t("nav.skipToContent")}
      </a>
      <header className="border-border bg-bg border-b pt-[env(safe-area-inset-top)] print:hidden">
        <div className="mx-auto flex h-14 w-full max-w-lg items-center px-4 md:h-16">
          <BrandLogo height={22} />
        </div>
      </header>
      {/* The phone's confirm bar is fixed to the bottom edge over the home indicator: the page ends above it. */}
      <main id="main" tabIndex={-1} className="min-w-0 flex-1 pb-[env(safe-area-inset-bottom)] outline-none md:pb-0">
        {children}
      </main>
    </div>
  );
}
