import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { canAt, factoryContext } from "@/features/partner/context/server";
import { PartnerPage } from "@/features/partner/frame";
import { MoreMenu } from "@/features/partner/shell/MoreMenu";
import { partnerBottomItems, partnerSections } from "@/features/partner/shell/sidebar";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partner.more"))("title") };
}

/**
 * The rest of the partner zone on a phone (round 2, Phase 1): the role's sidebar groups without
 * what the bottom bar already holds — what this role works with, nothing else.
 */
export default async function MorePage() {
  const [t, tItems, tGroups, tSections] = await Promise.all([
    getTranslations("partner.more"),
    getTranslations("partner.sidebar.items"),
    getTranslations("partner.sidebar.groups"),
    getTranslations("partner.sidebar.sections"),
  ]);
  const context = await factoryContext();
  const can = (permission: string) => canAt(context, permission);
  const status = context.factory?.status;
  const onBar = new Set(partnerBottomItems(status, context.roles, can).map((item) => item.key));
  // The sidebar's two sections (P4-04) — getpack's work, then the factory's ERP in its groups — less the bottom bar.
  const groups = partnerSections(status, context.roles, can).flatMap((section) =>
    section.groups
      .map((group) => ({ ...group, section: section.key, items: group.items.filter((item) => !onBar.has(item.key)) }))
      .filter((group) => group.items.length > 0),
  );
  const bodyKey = (key: string) => `items.${key === "shippingRates" ? "shipping" : key}.body`;
  return (
    <PartnerPage title={t("title")}>
      <MoreMenu
        label={t("search")}
        placeholder={t("searchPlaceholder")}
        empty={t("noMatch")}
        groups={groups.map((group) => ({
          key: `${group.section}-${group.key}`,
          title: group.section === "getpack" ? tSections("getpack") : tGroups(group.key),
          section: { key: group.section, title: tSections(group.section) },
          items: group.items.map((item) => ({
            key: item.key,
            href: item.href,
            icon: item.icon,
            title: tItems(item.key),
            ...(t.has(bodyKey(item.key)) ? { meta: t(bodyKey(item.key)) } : {}),
          })),
        }))}
      />
    </PartnerPage>
  );
}
