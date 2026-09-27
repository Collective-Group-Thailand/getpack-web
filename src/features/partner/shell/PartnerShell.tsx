import { getTranslations } from "next-intl/server";

import type { FactoryContext } from "@/features/partner/context/server";
import { AppShell } from "@/ui/components/AppShell";

import { partnerNav } from "./nav";
import { PartnerBottomNav } from "./PartnerBottomNav";
import { PartnerTopbar } from "./PartnerTopbar";

/**
 * The partner-factory frame: topbar, bottom nav on phones, a side list on tablets, big targets.
 *
 * A **server** component, unlike the admin shell — there is no collapsible sidebar and no
 * command palette to hold state for, so nothing here needs to be client code. That matters:
 * the partner budget is the tightest of the three at 180 KB on a mid-range Android over 4G
 * (`docs/performance-budgets.md`).
 *
 * The destinations follow the factory's stage and the user's role (`partnerNav`).
 */
export async function PartnerShell({ context, children }: { context: FactoryContext; children: React.ReactNode }) {
  const tCommon = await getTranslations("common");
  const t = await getTranslations("partner.nav");
  const items = partnerNav(context.factory?.status, (permission) => context.actor.permissions.includes(permission));

  return (
    <AppShell
      skipLabel={tCommon("nav.skipToContent")}
      header={<PartnerTopbar context={context} />}
      sidebar={<PartnerBottomNav items={items} variant="side" />}
      sidebarLabel={t("label")}
      bottomNav={<PartnerBottomNav items={items} />}
      reserveBottomNavSpace
      // 18 px base text on the shop floor (design-system.md §5).
      className="text-[1.125rem] md:text-base"
    >
      {children}
    </AppShell>
  );
}
