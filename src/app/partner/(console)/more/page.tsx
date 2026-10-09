import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { canAt, factoryContext } from "@/features/partner/context/server";
import { PartnerPage } from "@/features/partner/frame";
import { Row, RowList } from "@/features/partner/rows";
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
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`more-${group.key}`} className="flex flex-col gap-2">
          <h2 id={`more-${group.key}`} className="text-muted text-sm font-semibold">
            {tGroups(group.key)}
          </h2>
          <RowList>
            {group.items.map((item) => (
              <Row
                key={item.key}
                href={item.href}
                icon={item.icon}
                title={tItems(item.key)}
                meta={t.has(bodyKey(item.key)) ? t(bodyKey(item.key)) : undefined}
              />
            ))}
          </RowList>
        </section>
      ))}
    </PartnerPage>
  );
}
