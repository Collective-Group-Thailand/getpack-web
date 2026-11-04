import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AccountHeader } from "@/features/customer/account/AccountHeader";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getDataRefresh } from "@/features/customer/loyalty/api.server";
import { DataRefreshView } from "@/features/customer/loyalty/DataRefreshView";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.confirmData");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** The yearly data confirmation (loyalty P2, D-490; checklist task `data_refresh`). */
export default async function Page() {
  await requireCustomer();
  const [t, data] = await Promise.all([getTranslations("account.confirmData"), getDataRefresh()]);
  return (
    <div className="max-w-3xl">
      <AccountHeader className="mb-6" title={t("title")} lede={t("intro")} />
      <DataRefreshView initial={data} />
    </div>
  );
}
