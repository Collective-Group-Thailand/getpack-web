import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { canAt, factoryContext } from "@/features/partner/context/server";
import { PartnerPage } from "@/features/partner/frame";
import { partnerBottomItems, partnerSidebar } from "@/features/partner/shell/sidebar";
import { Icon } from "@/ui/icons";

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
          <ul className="flex flex-col gap-2">
            {group.items.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="border-border bg-surface hover:bg-surface-subtle flex min-h-16 items-center gap-3 rounded-xl border p-3"
                >
                  <Icon name={item.icon} size={28} className="text-primary shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{tItems(item.key)}</span>
                    {t.has(bodyKey(item.key)) ? (
                      <span className="text-muted text-sm">{t(bodyKey(item.key))}</span>
                    ) : null}
                  </span>
                  <Icon name="chevron-right" size={24} className="text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </PartnerPage>
  );
}
