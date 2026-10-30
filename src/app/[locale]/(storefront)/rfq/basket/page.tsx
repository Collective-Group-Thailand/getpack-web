import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getDraftBasket } from "@/features/customer/rfq/basket/api.server";
import { BasketDraft } from "@/features/customer/rfq/basket/BasketDraft";
import { Callout } from "@/ui/components/Callout";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("quoteRequests.basket");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** The RFQ basket (U5.4, D-301): several RFQ-only items, one submission, one conversation. */
export default async function Page({ searchParams }: { searchParams: Promise<{ added?: string }> }) {
  await requireCustomer();
  const [t, basket, { added }] = await Promise.all([
    getTranslations("quoteRequests.basket"),
    getDraftBasket(),
    searchParams,
  ]);
  return (
    <div className="max-w-nav mx-auto flex w-full flex-col gap-6 px-5 pt-6 pb-16 md:px-8 md:pt-8 md:pb-20 xl:px-12">
      <header>
        <h1 className="text-[1.75rem] leading-[1.15] font-semibold tracking-tight text-balance md:text-[2.25rem]">
          {t("title")}
        </h1>
        <p className="text-muted mt-2 max-w-[60ch] text-pretty">{t("intro")}</p>
      </header>
      {added ? <Callout tone="success" title={t("added")} /> : null}
      <BasketDraft initial={basket} />
    </div>
  );
}
