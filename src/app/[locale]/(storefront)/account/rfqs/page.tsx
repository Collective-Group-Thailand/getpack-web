import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { requireCustomer } from "@/features/customer/auth/guard.server";
import { AccountHeader } from "@/features/customer/account/AccountHeader";
import { Panel } from "@/features/customer/account/Panel";
import { PortalTable } from "@/features/customer/account/PortalTable";
import { filterByStatus, StatusSummary, StatusTabs } from "@/features/customer/account/StatusOverview";
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
export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [, search] = await Promise.all([requireCustomer(), searchParams]);
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
  const { current, rows } = filterByStatus(list, search.status);

  return (
    <div>
      <AccountHeader
        title={t("title")}
        lede={t("intro")}
        actions={
          <Button asChild iconStart="plus">
            <Link href="/products">{t("browse")}</Link>
          </Button>
        }
      />
      {list.length > 0 ? (
        <StatusSummary
          className="mt-6"
          rows={list}
          map={RFQ_STATUS}
          statuses={["quoted", "need_info", "in_review", "accepted"]}
          highlight="quoted"
        />
      ) : null}
      {/* Project B3: the baskets as their own block of cards, above the requests. */}
      {draft || sent.length > 0 ? (
        <Panel id="rfq-baskets" title={tBasket("listTitle")} className="mt-6">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {draft ? (
              <li>
                <Link
                  href="/rfq/basket"
                  className="border-border hover:bg-surface-subtle focus-visible:ring-focus-ring rounded-control flex h-full flex-wrap items-center justify-between gap-2 border p-4 outline-none focus-visible:ring-2"
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
                  className="border-border hover:bg-surface-subtle focus-visible:ring-focus-ring rounded-control flex h-full flex-wrap items-center justify-between gap-2 border p-4 outline-none focus-visible:ring-2"
                >
                  <span>
                    <span className="font-medium tabular-nums">{basket.basketCode}</span>
                    <span className="text-muted ms-2 text-sm">
                      {tBasket("sentRow", { count: basket.items.length })}
                    </span>
                  </span>
                  <StatusChip map={RFQ_BASKET_STATUS} value={basket.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
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
        <>
          <StatusTabs
            className="mt-6"
            rows={list}
            map={RFQ_STATUS}
            basePath="/account/rfqs"
            current={current}
            label={t("table.status")}
          />
          <PortalTable
            className="mt-4"
            caption={t("table.caption")}
            columns={[
              { key: "request", label: t("table.request"), className: "md:w-[40%]" },
              { key: "quantities", label: t("table.quantities"), numeric: true, className: "md:whitespace-nowrap" },
              { key: "submitted", label: t("table.submitted"), className: "md:whitespace-nowrap" },
              { key: "status", label: t("table.status"), className: "md:whitespace-nowrap" },
              {
                key: "actions",
                label: t("table.actions"),
                srOnly: true,
                className: "text-end md:w-px md:whitespace-nowrap",
              },
            ]}
            rows={rows.map((rfq) => ({
              id: rfq.id,
              phoneSubtitle: <span className="tabular-nums">{rfq.rfqCode}</span>,
              cells: {
                request: (
                  <span className="block min-w-0">
                    <Link
                      href={`/account/rfqs/${rfq.id}`}
                      className="text-fg block font-semibold underline-offset-4 hover:underline"
                    >
                      {rfq.productTypeName}
                    </Link>
                    <span className="text-muted hidden text-xs font-normal tabular-nums md:block">{rfq.rfqCode}</span>
                  </span>
                ),
                quantities: rfq.quantities.map((quantity) => format.number(quantity)).join(", "),
                submitted: format.date(rfq.submittedAt),
                status: <StatusChip map={RFQ_STATUS} value={rfq.status} />,
                actions: (
                  <Button asChild size="sm" variant="secondary">
                    <Link href={`/account/rfqs/${rfq.id}`}>
                      {t("table.view")}
                      <span className="sr-only"> {rfq.rfqCode}</span>
                    </Link>
                  </Button>
                ),
              },
            }))}
          />
        </>
      )}
    </div>
  );
}
