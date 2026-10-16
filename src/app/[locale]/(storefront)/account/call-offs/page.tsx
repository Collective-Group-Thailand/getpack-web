import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { requireCustomer } from "@/features/customer/auth/guard.server";
import { PortalTable } from "@/features/customer/account/PortalTable";
import { pick } from "@/features/customer/catalog/localize";
import { listCallOffs } from "@/features/customer/repeat/api.server";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { CALL_OFF_STATUS } from "@/domain/status";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.callOffs");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** My call-off agreements (U2.F5, D-290): what is committed, released and left, and until when. */
export default async function Page() {
  await requireCustomer();
  const [t, format, locale, agreements] = await Promise.all([
    getTranslations("account.callOffs"),
    getFormat(),
    getLocale(),
    listCallOffs(),
  ]);
  return (
    <div>
      <h1 className="text-title leading-tight">{t("title")}</h1>
      <p className="text-muted mt-1">{t("intro")}</p>
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
        <PortalTable
          className="mt-6"
          caption={t("table.caption")}
          columns={[
            { key: "product", label: t("table.product"), className: "md:w-[34%]" },
            { key: "progress", label: t("table.progress"), numeric: true, className: "md:whitespace-nowrap" },
            { key: "remaining", label: t("table.remaining"), numeric: true, className: "md:whitespace-nowrap" },
            { key: "until", label: t("table.until") },
            { key: "status", label: t("table.status") },
            { key: "actions", label: t("table.actions"), srOnly: true, className: "text-end" },
          ]}
          rows={agreements.map((a) => {
            const name = pick(locale, a.productType.nameTh, a.productType.nameEn);
            return {
              id: a.id,
              phoneSubtitle: a.quoteCode ? <span className="font-mono">{a.quoteCode}</span> : null,
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
                      <span className="text-muted hidden font-mono text-xs font-normal md:block">{a.quoteCode}</span>
                    ) : null}
                  </span>
                ),
                progress: `${format.number(a.releasedQuantity)} / ${format.number(a.committedQuantity)} ${a.unit}`,
                remaining: `${format.number(a.remainingQuantity)} ${a.unit}`,
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
      )}
    </div>
  );
}
