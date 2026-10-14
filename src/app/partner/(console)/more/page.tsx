import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { canAt, factoryContext } from "@/features/partner/context/server";
import { PartnerPage } from "@/features/partner/frame";
import { MoreMenu } from "@/features/partner/shell/MoreMenu";
import { partnerBottomItems, partnerSidebar } from "@/features/partner/shell/sidebar";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partner.more"))("title") };
}

/**
 * The rest of the partner zone on a phone (round 2, Phase 1): the role's sidebar groups without
 * what the bottom bar already holds — what this role works with, nothing else.
 */
export default async function MorePage() {
  const [t, tItems, tGroups] = await Promise.all([
    getTranslations("partner.more"),
    getTranslations("partner.sidebar.items"),
    getTranslations("partner.sidebar.groups"),
  ]);
  const context = await factoryContext();
  const can = (permission: string) => canAt(context, permission);
  const status = context.factory?.status;
  const onBar = new Set(partnerBottomItems(status, context.roles, can).map((item) => item.key));
  const groups = partnerSidebar(status, context.roles, can)
    .map((group) => ({ ...group, items: group.items.filter((item) => !onBar.has(item.key)) }))
    .filter((group) => group.items.length > 0);
  const bodyKey = (key: string) => `items.${key === "shippingRates" ? "shipping" : key}.body`;
  return (
    <PartnerPage title={t("title")}>
      <MoreMenu
        label={t("search")}
        placeholder={t("searchPlaceholder")}
        empty={t("noMatch")}
        groups={groups.map((group) => ({
          key: group.key,
          title: tGroups(group.key),
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
