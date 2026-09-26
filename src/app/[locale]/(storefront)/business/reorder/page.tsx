import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { BulkReorder } from "@/features/customer/business/BulkReorder";
import { requireMember } from "@/features/customer/business/guard.server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("business.reorder");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** Bulk reorder from a CSV (F3 3.7, D-153). */
export default async function Page() {
  await requireMember();
  const t = await getTranslations("business.reorder");
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted mt-2">{t("intro")}</p>
      </header>
      <BulkReorder />
    </div>
  );
}
