import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { requireCustomer } from "@/features/customer/auth/guard.server";
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
        <ul className="mt-6 flex flex-col gap-3">
          {agreements.map((a) => (
            <li key={a.id} className="bg-surface border-border rounded-xl border">
              <Link
                href={`/account/call-offs/${a.id}`}
                className="hover:bg-bg-subtle flex flex-wrap items-center justify-between gap-3 rounded-xl p-4"
              >
                <div className="min-w-0">
                  <p className="font-semibold">
                    {pick(locale, a.productType.nameTh, a.productType.nameEn)}
                    {a.quoteCode ? <span className="text-muted ms-2 font-mono text-sm">{a.quoteCode}</span> : null}
                  </p>
                  <p className="text-muted text-sm">
                    {t("row", {
                      released: format.number(a.releasedQuantity),
                      committed: format.number(a.committedQuantity),
                      left: format.number(a.remainingQuantity),
                      unit: a.unit,
                    })}
                    {a.expiresAt ? ` · ${t("until", { date: format.date(a.expiresAt) })}` : ""}
                  </p>
                </div>
                <StatusChip map={CALL_OFF_STATUS} value={a.status} size="md" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
