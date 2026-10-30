import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { requireCustomer } from "@/features/customer/auth/guard.server";
import { AccountHeader } from "@/features/customer/account/AccountHeader";
import { PortalTable } from "@/features/customer/account/PortalTable";
import { filterByStatus, StatusSummary, StatusTabs } from "@/features/customer/account/StatusOverview";
import { pick } from "@/features/customer/catalog/localize";
import { unitLabel } from "@/features/customer/catalog/unit-label";
import { listCallOffs } from "@/features/customer/repeat/api.server";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { CALL_OFF_STATUS } from "@/domain/status";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Meter } from "@/ui/components/Meter";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.callOffs");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** My call-off agreements (U2.F5, D-290): what is committed, released and left, and until when. */
export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [, search] = await Promise.all([requireCustomer(), searchParams]);
  const [t, tCatalog, format, locale, agreements] = await Promise.all([
    getTranslations("account.callOffs"),
    getTranslations("catalog"),
    getFormat(),
    getLocale(),
    listCallOffs(),
  ]);
  const { current, rows } = filterByStatus(agreements, search.status);
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
      {agreements.length > 0 ? (
        <StatusSummary
          className="mt-6"
          rows={agreements}
          map={CALL_OFF_STATUS}
          statuses={["active", "pending_confirmation", "expired"]}
          highlight="active"
        />
      ) : null}
      {agreements.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon="calendar"
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
            rows={agreements}
            map={CALL_OFF_STATUS}
            basePath="/account/call-offs"
            current={current}
            label={t("table.status")}
          />
          <PortalTable
            className="mt-4"
            caption={t("table.caption")}
            columns={[
              { key: "product", label: t("table.product"), className: "md:w-[34%]" },
              { key: "progress", label: t("table.progress"), className: "md:w-[22%]" },
              { key: "remaining", label: t("table.remaining"), numeric: true, className: "md:whitespace-nowrap" },
              { key: "until", label: t("table.until"), className: "md:whitespace-nowrap" },
              { key: "status", label: t("table.status"), className: "md:whitespace-nowrap" },
              {
                key: "actions",
                label: t("table.actions"),
                srOnly: true,
                className: "text-end md:w-px md:whitespace-nowrap",
              },
            ]}
            rows={rows.map((a) => {
              const name = pick(locale, a.productType.nameTh, a.productType.nameEn);
              const unit = unitLabel(tCatalog, a.unit);
              const progress = `${format.number(a.releasedQuantity)} / ${format.number(a.committedQuantity)} ${unit}`;
              return {
                id: a.id,
                phoneSubtitle: a.quoteCode ? <span className="tabular-nums">{a.quoteCode}</span> : null,
                cells: {
                  product: (
                    <span className="block min-w-0">
                      <Link
                        href={`/account/call-offs/${a.id}`}
                        className="text-fg block font-semibold underline-offset-4 hover:underline"
                      >
                        {name}
                      </Link>
                      {a.quoteCode ? (
                        <span className="text-muted hidden text-xs font-normal tabular-nums md:block">
                          {a.quoteCode}
                        </span>
                      ) : null}
                    </span>
                  ),
                  progress: (
                    <span className="flex min-w-32 flex-col gap-1.5">
                      <span className="tabular-nums">{progress}</span>
                      <Meter
                        value={a.committedQuantity > 0 ? (a.releasedQuantity / a.committedQuantity) * 100 : 0}
                        label={t("table.progress")}
                        valueText={progress}
                      />
                    </span>
                  ),
                  remaining: `${format.number(a.remainingQuantity)} ${unit}`,
                  until: a.expiresAt ? (
                    format.date(a.expiresAt)
                  ) : (
                    <span className="text-muted">{t("table.noExpiry")}</span>
                  ),
                  status: <StatusChip map={CALL_OFF_STATUS} value={a.status} />,
                  actions: (
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/account/call-offs/${a.id}`}>
                        {t("table.view")}
                        <span className="sr-only"> {a.quoteCode ?? name}</span>
                      </Link>
                    </Button>
                  ),
                },
              };
            })}
          />
        </>
      )}
    </div>
  );
}
