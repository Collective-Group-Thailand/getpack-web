import { getTranslations } from "next-intl/server";

import { FACTORY_STATUS } from "@/domain/status";
import type { FactoryContext } from "@/features/partner/context/server";
import { AppShell } from "@/ui/components/AppShell";

import { PartnerBottomNav } from "./PartnerBottomNav";
import { PartnerSidebar } from "./PartnerSidebar";
import { partnerBottomItems, partnerSidebar } from "./sidebar";
import { PartnerTopbar } from "./PartnerTopbar";

/**
 * The partner-factory frame: topbar, bottom nav on phones, a side list on tablets, big targets.
 *
 * A **server** component, unlike the admin shell — there is no collapsible sidebar and no
 * command palette to hold state for, so nothing here needs to be client code. That matters:
 * the partner budget is the tightest of the three at 180 KB on a mid-range Android over 4G
 * (`docs/performance-budgets.md`).
 *
 * The destinations follow the factory's stage and the user's roles at it (`partnerSidebar`,
 * `partnerBottomItems`): grouped in the sidebar, the daily four on a phone's bottom bar.
 */
export async function PartnerShell({ context, children }: { context: FactoryContext; children: React.ReactNode }) {
  const tCommon = await getTranslations("common");
  const t = await getTranslations("partner.nav");
  const can = (permission: string) => context.actor.permissions.includes(permission);
  const status = context.factory?.status;
  const groups = partnerSidebar(status, context.roles, can);
  const bottom = partnerBottomItems(status, context.roles, can);
  const tRoles = await getTranslations("partner.shell.roles");
  const tStatusNs = await getTranslations("status");
  const tStatus = (value: string) => {
    const meta = (FACTORY_STATUS as Record<string, { labelKey: string } | undefined>)[value];
    return meta ? tStatusNs(meta.labelKey) : value;
  };
  const roleNames = context.roles.map((role) => (tRoles.has(role) ? tRoles(role) : role)).join(" · ");
  const factoryName = context.factories.find((f) => f.factoryId === context.factoryId)?.name ?? "";

  return (
    <AppShell
      skipLabel={tCommon("nav.skipToContent")}
      header={<PartnerTopbar context={context} />}
      sidebar={
        <PartnerSidebar
          groups={groups}
          factory={{ name: factoryName, status: status ? tStatus(status) : null }}
          user={{ name: context.actor.displayName, roles: roleNames }}
        />
      }
      sidebarLabel={t("label")}
      // White beside the paper page, like the topbar: the menu reads as its own panel, not as page text.
      sidebarClassName="bg-surface"
      bottomNav={<PartnerBottomNav items={bottom} />}
      reserveBottomNavSpace
      // 15 px base text everywhere — the admin console's density (sizes of controls: base.css,
      // partner block); inputs stay 16 px on a phone so iOS does not zoom.
      className="text-base"
    >
      {children}
    </AppShell>
  );
}
