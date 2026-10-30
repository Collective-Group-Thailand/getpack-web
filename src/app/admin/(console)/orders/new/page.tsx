import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { CreateOrder } from "@/features/admin/cs";
import Link from "next/link";

import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("cs.createOrder"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** CS create-order always starts from a saved quotation: the price is the quotation's. */
export default async function NewOrderPage({ searchParams }: Props) {
  const t = await getTranslations("cs.createOrder");
  const tMenu = await getTranslations("admin.menu");
  const query = await searchParams;
  const quoteId = typeof query.quote === "string" ? query.quote : null;
  const optionId = typeof query.option === "string" ? query.option : undefined;
  const quantity = Number(query.quantity) || undefined;
  return (
    <ConsolePage>
      <PageHeader back={{ href: "/orders", label: t("orders") }} title={t("title")} description={t("description")} />
      {quoteId ? (
        <CreateOrder quoteId={quoteId} optionId={optionId} quantity={quantity} />
      ) : (
        // Not a dead end: the order starts from a saved quotation, or from the CS calculator that makes one.
        <EmptyState
          icon="calculator"
          title={t("needQuote")}
          description={t("needQuoteBody")}
          action={
            <Button asChild>
              <Link href="/quotations">{tMenu("quotations")}</Link>
            </Button>
          }
          secondary={
            <Link href="/cs" className="text-primary font-medium hover:underline">
              {tMenu("cs_calculators")}
            </Link>
          }
        />
      )}
    </ConsolePage>
  );
}
