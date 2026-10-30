import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { requireCustomer } from "@/features/customer/auth/guard.server";
import { AccountHeader } from "@/features/customer/account/AccountHeader";
import { PortalTable } from "@/features/customer/account/PortalTable";
import { filterByStatus, StatusSummary, StatusTabs } from "@/features/customer/account/StatusOverview";
import { listMySamples } from "@/features/customer/samples/api.server";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { SAMPLE_KIND, SAMPLE_STATUS } from "@/domain/status";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("myOrders.samples");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** My samples (U2.F3): asked for before ordering, or attached to an order, and where each stands. */
export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [, search] = await Promise.all([requireCustomer(), searchParams]);
  const [t, format, samples] = await Promise.all([getTranslations("myOrders.samples"), getFormat(), listMySamples()]);
  const { current, rows } = filterByStatus(samples, search.status);
  return (
    <div>
      <AccountHeader
        title={t("title")}
        lede={t("intro")}
        actions={
          <Button asChild variant="secondary" iconStart="receipt">
            <Link href="/account/quotes">{t("toQuotes")}</Link>
          </Button>
        }
      />
      {samples.length > 0 ? (
        <StatusSummary
          className="mt-6"
          rows={samples}
          map={SAMPLE_STATUS}
          statuses={["quoted", "delivered", "shipped", "approved"]}
          highlight="quoted"
        />
      ) : null}
      {samples.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon="package-check"
          title={t("emptyTitle")}
          description={t("emptyBody")}
          action={
            <Button asChild>
              <Link href="/account/quotes">{t("toQuotes")}</Link>
            </Button>
          }
        />
      ) : (
        <>
          <StatusTabs
            className="mt-6"
            rows={samples}
            map={SAMPLE_STATUS}
            basePath="/account/samples"
            current={current}
            label={t("table.status")}
          />
          <PortalTable
            className="mt-4"
            caption={t("table.caption")}
            columns={[
              { key: "sample", label: t("table.sample"), className: "md:w-[34%]" },
              { key: "kind", label: t("table.kind"), className: "md:whitespace-nowrap" },
              { key: "asked", label: t("table.asked"), className: "md:min-w-[7.5rem]" },
              { key: "price", label: t("table.price"), numeric: true, className: "md:whitespace-nowrap" },
              { key: "status", label: t("table.status"), className: "md:whitespace-nowrap" },
              {
                key: "actions",
                label: t("table.actions"),
                srOnly: true,
                className: "text-end md:w-px md:whitespace-nowrap",
              },
            ]}
            rows={rows.map((sample) => ({
              id: sample.id,
              phoneSubtitle: sample.orderCode ? <span className="tabular-nums">{sample.orderCode}</span> : null,
              cells: {
                sample: (
                  <span className="block min-w-0">
                    <Link
                      href={`/account/samples/${sample.id}`}
                      className="text-fg block font-semibold underline-offset-4 hover:underline"
                    >
                      {t(`mockup.${sample.mockupOption}`)}
                    </Link>
                    {sample.orderCode ? (
                      <span className="text-muted hidden text-xs font-normal tabular-nums md:block">
                        {sample.orderCode}
                      </span>
                    ) : null}
                  </span>
                ),
                kind: <StatusChip map={SAMPLE_KIND} value={sample.kind} />,
                asked: <span className="md:whitespace-nowrap">{format.date(sample.createdAt)}</span>,
                price: sample.sellGrossAmount ? (
                  format.thb(sample.sellGrossAmount)
                ) : (
                  <span className="text-muted">{t("table.free")}</span>
                ),
                status: <StatusChip map={SAMPLE_STATUS} value={sample.status} />,
                actions: (
                  <Button asChild size="sm" variant="secondary">
                    <Link href={`/account/samples/${sample.id}`}>
                      {t("table.view")}
                      <span className="sr-only"> {sample.orderCode ?? t(`mockup.${sample.mockupOption}`)}</span>
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
