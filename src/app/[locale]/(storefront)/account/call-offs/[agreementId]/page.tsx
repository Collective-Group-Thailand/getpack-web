import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { requireCustomer } from "@/features/customer/auth/guard.server";
import { findMyCompany } from "@/features/customer/business/companies.server";
import { pick } from "@/features/customer/catalog/localize";
import { getCallOff } from "@/features/customer/repeat/api.server";
import { CallOffActions } from "@/features/customer/repeat/CallOffActions";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { CALL_OFF_RELEASE_STATUS, CALL_OFF_STATUS } from "@/domain/status";
import { Link } from "@/i18n/navigation";
import { DescriptionList } from "@/ui/components/DescriptionList";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.callOffs");
  return { title: t("detailTitle"), robots: { index: false, follow: false } };
}

/** One call-off (U2.F5, D-290): its locked price and window, the release schedule so far, what is left. */
export default async function Page({ params }: { params: Promise<{ agreementId: string }> }) {
  await requireCustomer();
  const { agreementId } = await params;
  const [t, format, locale, agreement, company] = await Promise.all([
    getTranslations("account.callOffs"),
    getFormat(),
    getLocale(),
    getCallOff(agreementId),
    findMyCompany().catch(() => null),
  ]);
  if (!agreement) notFound();
  // Committing money: a company member needs the company's "order" right; a person buys for themselves.
  const canOrder = company ? company.can.order : true;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Link href="/account/call-offs" className="text-primary text-sm underline-offset-4 hover:underline">
          {t("back")}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-title leading-tight">
            {pick(locale, agreement.productType.nameTh, agreement.productType.nameEn)}
          </h1>
          <StatusChip map={CALL_OFF_STATUS} value={agreement.status} size="md" />
        </div>
        {agreement.status === "pending_confirmation" ? <p className="text-sm">{t("pending")}</p> : null}
        {agreement.declineReason ? <p className="text-danger text-sm">{agreement.declineReason}</p> : null}
      </header>
      <DescriptionList
        columns={2}
        items={[
          { term: t("committed"), description: `${format.number(agreement.committedQuantity)} ${agreement.unit}` },
          { term: t("released"), description: `${format.number(agreement.releasedQuantity)} ${agreement.unit}` },
          { term: t("left"), description: `${format.number(agreement.remainingQuantity)} ${agreement.unit}` },
          { term: t("minRelease"), description: `${format.number(agreement.minReleaseQuantity)} ${agreement.unit}` },
          ...(agreement.unitPrice ? [{ term: t("unitPrice"), description: format.thb(agreement.unitPrice) }] : []),
          {
            term: t("window"),
            description:
              agreement.startsAt && agreement.expiresAt
                ? t("windowValue", { from: format.date(agreement.startsAt), to: format.date(agreement.expiresAt) })
                : t("windowPending", { months: agreement.months }),
          },
          ...(agreement.quoteCode ? [{ term: t("quote"), description: agreement.quoteCode }] : []),
        ]}
      />
      <section aria-labelledby="releases" className="flex flex-col gap-2">
        <h2 id="releases" className="text-lg font-semibold">
          {t("releases")}
        </h2>
        {agreement.releases.length === 0 ? (
          <p className="text-muted text-sm">{t("noReleases")}</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {agreement.releases.map((r) => (
              <li
                key={r.id}
                className="bg-surface border-border flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
              >
                <span>
                  {t("releaseRow", {
                    seq: r.seq,
                    quantity: format.number(r.quantity),
                    unit: agreement.unit,
                    date: format.date(r.createdAt),
                  })}
                  {r.includesOneOffs ? <span className="text-muted ms-2 text-xs">{t("oneOffs")}</span> : null}
                  {r.order ? (
                    <Link
                      href={`/account/orders/${r.order.orderId}`}
                      className="text-primary ms-2 underline underline-offset-4"
                    >
                      {r.order.orderCode}
                    </Link>
                  ) : null}
                </span>
                <StatusChip map={CALL_OFF_RELEASE_STATUS} value={r.status} />
              </li>
            ))}
          </ol>
        )}
      </section>
      <CallOffActions agreement={agreement} canOrder={canOrder} />
    </div>
  );
}
