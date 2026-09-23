import { getTranslations } from "next-intl/server";

import type { PartnerMe } from "@/lib/api/types";
import { AppShell } from "@/ui/components/AppShell";

import { PartnerBottomNav } from "./PartnerBottomNav";
import { PartnerTopbar } from "./PartnerTopbar";

/**
 * The partner-factory frame: topbar, bottom nav, big targets.
 *
 * A **server** component, unlike the admin shell — there is no collapsible sidebar and no
 * command palette to hold state for, so nothing here needs to be client code. That matters:
 * the partner budget is the tightest of the three at 180 KB on a mid-range Android over 4G
 * (`docs/performance-budgets.md`).
 *
 * F5 builds the zone; this is the frame it hangs on.
 */
export async function PartnerShell({ actor, children }: { actor: PartnerMe; children: React.ReactNode }) {
  const tCommon = await getTranslations("common");

  return (
    <AppShell
      skipLabel={tCommon("nav.skipToContent")}
      header={<PartnerTopbar actor={actor} />}
      bottomNav={<PartnerBottomNav />}
      reserveBottomNavSpace
      // 18 px base text on the shop floor (design-system.md §5).
      className="text-[1.125rem] md:text-base"
    >
      {children}
    </AppShell>
  );
}
