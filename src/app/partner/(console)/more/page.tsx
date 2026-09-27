import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { canAt, factoryContext } from "@/features/partner/context/server";
import { PartnerPage } from "@/features/partner/frame";
import { MORE_ITEMS } from "@/features/partner/shell/more";
import { Icon } from "@/ui/icons";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partner.more"))("title") };
}

/** The rest of the partner zone, as big rows — what this role may open, nothing else. */
export default async function MorePage() {
  const t = await getTranslations("partner.more");
  const context = await factoryContext();
  const items = MORE_ITEMS.filter((item) => !item.permission || canAt(context, item.permission));
  return (
    <PartnerPage title={t("title")}>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className="border-border bg-surface hover:bg-surface-subtle flex min-h-16 items-center gap-3 rounded-xl border p-3"
            >
              <Icon name={item.icon} size={28} className="text-primary shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{t(`items.${item.key}.title`)}</span>
                <span className="text-muted text-sm">{t(`items.${item.key}.body`)}</span>
              </span>
              <Icon name="chevron-right" size={24} className="text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </PartnerPage>
  );
}
