import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { AccountHeader } from "@/features/customer/account/AccountHeader";
import { Panel } from "@/features/customer/account/Panel";
import { SummaryCards } from "@/features/customer/account/SummaryCards";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { findMyCompany } from "@/features/customer/business/companies.server";
import { pick } from "@/features/customer/catalog/localize";
import { unitLabel } from "@/features/customer/catalog/unit-label";
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
  const [t, tCatalog, format, locale, agreement, company] = await Promise.all([
    getTranslations("account.callOffs"),
    getTranslations("catalog"),
    getFormat(),
    getLocale(),
    getCallOff(agreementId),
    findMyCompany().catch(() => null),
  ]);
  if (!agreement) notFound();
  // Committing money: a company member needs the company's "order" right; a person buys for themselves.
  const canOrder = company ? company.can.order : true;

  const unit = unitLabel(tCatalog, agreement.unit);
  return (
    <div>
      <AccountHeader
        back={{ href: "/account/call-offs", label: t("back") }}
        title={pick(locale, agreement.productType.nameTh, agreement.productType.nameEn)}
        status={<StatusChip map={CALL_OFF_STATUS} value={agreement.status} size="md" />}
        lede={agreement.status === "pending_confirmation" ? t("pending") : undefined}
      >
        {agreement.declineReason ? <p className="text-danger mt-1.5 text-sm">{agreement.declineReason}</p> : null}
      </AccountHeader>
      {/* Project B3: the quantities on top (what is left on the tint), the releases so far, and beside them the
          agreement's terms with the next release. */}
      <SummaryCards
        className="mt-6"
        items={[
          {
            key: "left",
            label: t("left"),
            value: `${format.number(agreement.remainingQuantity)} ${unit}`,
            icon: "box",
            highlight: true,
          },
          { key: "committed", label: t("committed"), value: `${format.number(agreement.committedQuantity)} ${unit}` },
          { key: "released", label: t("released"), value: `${format.number(agreement.releasedQuantity)} ${unit}` },
          ...(agreement.unitPrice
            ? [{ key: "unitPrice", label: t("unitPrice"), value: format.thb(agreement.unitPrice) }]
            : [
                {
                  key: "minRelease",
                  label: t("minRelease"),
                  value: `${format.number(agreement.minReleaseQuantity)} ${unit}`,
                },
              ]),
        ]}
      />
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Panel id="releases" title={t("releases")}>
          {agreement.releases.length === 0 ? (
            <p className="text-muted text-sm">{t("noReleases")}</p>
          ) : (
            <ol className="divide-border border-border divide-y rounded-lg border">
              {agreement.releases.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <span className="min-w-0">
                    <span className="block font-medium">
                      {t("releaseRow", {
                        seq: r.seq,
                        quantity: format.number(r.quantity),
                        unit,
                        date: format.date(r.createdAt),
                      })}
                    </span>
                    {r.includesOneOffs || r.order ? (
                      <span className="text-muted mt-0.5 flex flex-wrap gap-x-2 text-xs">
                        {r.includesOneOffs ? <span>{t("oneOffs")}</span> : null}
                        {r.order ? (
                          <Link
                            href={`/account/orders/${r.order.orderId}`}
                            className="text-primary tabular-nums underline underline-offset-4"
                          >
                            {r.order.orderCode}
                          </Link>
                        ) : null}
                      </span>
                    ) : null}
                  </span>
                  <StatusChip map={CALL_OFF_RELEASE_STATUS} value={r.status} />
                </li>
              ))}
            </ol>
          )}
        </Panel>
        <div className="flex flex-col gap-4 lg:sticky lg:top-[calc(var(--site-sticky-top,0px)+1rem)]">
          <div className="border-border bg-surface rounded-card border p-4 sm:p-5">
            <DescriptionList
              items={[
                { term: t("minRelease"), description: `${format.number(agreement.minReleaseQuantity)} ${unit}` },
                {
                  term: t("window"),
                  description:
                    agreement.startsAt && agreement.expiresAt
                      ? t("windowValue", {
                          from: format.date(agreement.startsAt),
                          to: format.date(agreement.expiresAt),
                        })
                      : t("windowPending", { months: agreement.months }),
                },
                ...(agreement.quoteCode ? [{ term: t("quote"), description: agreement.quoteCode }] : []),
              ]}
            />
          </div>
          <CallOffActions agreement={agreement} canOrder={canOrder} />
        </div>
      </div>
    </div>
  );
}
