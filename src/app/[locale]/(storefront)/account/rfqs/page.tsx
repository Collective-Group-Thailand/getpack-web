import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { requireCustomer } from "@/features/customer/auth/guard.server";
import { listMyRfqs } from "@/features/customer/rfq/api.server";
import { listBaskets } from "@/features/customer/rfq/basket/api.server";
import { RFQ_BASKET_STATUS } from "@/domain/status";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { RFQ_STATUS } from "@/domain/status";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("quoteRequests.list");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** The customer's requests for quotation and where each stands (F3 3.2). */
export default async function Page() {
  await requireCustomer();
  const [t, tBasket, format, list, baskets] = await Promise.all([
    getTranslations("quoteRequests.list"),
    getTranslations("quoteRequests.basket"),
    getFormat(),
    listMyRfqs(),
    // A basket list that fails never takes the RFQs down with it.
    listBaskets().catch(() => []),
  ]);
  const draft = baskets.find((basket) => basket.status === "draft" && basket.items.length > 0);
  const sent = baskets.filter((basket) => basket.status === "submitted");

  return (
    <div>
      <h1 className="text-title leading-tight">{t("title")}</h1>
      <p className="text-muted mt-1">{t("intro")}</p>
      {draft || sent.length > 0 ? (
        <section aria-labelledby="rfq-baskets" className="mt-6">
          <h2 id="rfq-baskets" className="text-lg font-semibold">
            {tBasket("listTitle")}
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {draft ? (
              <li>
                <Link
                  href="/rfq/basket"
                  className="border-border hover:bg-bg-subtle flex flex-wrap items-center justify-between gap-2 rounded-xl border p-4"
                >
                  <span className="font-medium">{tBasket("draftRow", { count: draft.items.length })}</span>
                  <StatusChip map={RFQ_BASKET_STATUS} value={draft.status} />
                </Link>
              </li>
            ) : null}
            {sent.map((basket) => (
              <li key={basket.id}>
                <Link
                  href={`/account/rfq-baskets/${basket.id}`}
                  className="border-border hover:bg-bg-subtle flex flex-wrap items-center justify-between gap-2 rounded-xl border p-4"
                >
                  <span>
                    <span className="font-mono font-medium">{basket.basketCode}</span>
                    <span className="text-muted ms-2 text-sm">
                      {tBasket("sentRow", { count: basket.items.length })}
                    </span>
                  </span>
                  <StatusChip map={RFQ_BASKET_STATUS} value={basket.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {list.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon="inbox"
          title={t("emptyTitle")}
          description={t("emptyBody")}
          action={
            <Button asChild>
              <Link href="/products">{t("browse")}</Link>
            </Button>
          }
        />
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {list.map((rfq) => (
            <li key={rfq.id} className="bg-surface border-border rounded-xl border">
              <Link
                href={`/account/rfqs/${rfq.id}`}
                className="hover:bg-bg-subtle flex flex-wrap items-center justify-between gap-3 rounded-xl p-4"
              >
                <div className="min-w-0">
                  <p className="font-semibold">
                    {rfq.productTypeName} <span className="text-muted font-mono text-sm">{rfq.rfqCode}</span>
                  </p>
                  <p className="text-muted text-sm">
                    {t("row", {
                      quantities: rfq.quantities.map((quantity) => format.number(quantity)).join(", "),
                      date: format.date(rfq.submittedAt),
                    })}
                  </p>
                </div>
                <StatusChip map={RFQ_STATUS} value={rfq.status} size="md" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
