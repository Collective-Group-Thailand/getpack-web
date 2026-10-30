import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PAYOUT_ITEM_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PostedEntries } from "@/features/partner/ledger/PostedEntries";
import { ActionPanel, PageError, PartnerDetail, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { ViewFile } from "@/features/partner/viewer";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/partner/status";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";

type Props = { params: Promise<{ payoutId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerBilling.payout"))("metaTitle") };
}

/**
 * One payout (`partner.payables.getPayout`): what it paid for, what was withheld and deducted, the
 * bank's reference, and — once paid — its documents (`partner.payables.payoutDocuments`): the
 * remittance advice and the WHT certificates (50 ทวิ), as short-lived links.
 */
export default async function PayoutPage({ params }: Props) {
  const { payoutId } = await params;
  const t = await getTranslations("partnerBilling.payout");
  const tSources = await getTranslations("partnerBilling.payouts.sources");
  const tKinds = await getTranslations("partnerBilling.payouts.kinds");
  const format = await getFormat();
  const context = await factoryContext();
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId, payoutId };
  const found = await attempt(
    async () =>
      (await contract.GET("/v1/partner/factories/{factoryId}/payouts/{payoutId}", { params: { path } })).data!,
  );
  const back = { href: "/payouts", label: t("back") };
  if (!found.data)
    return (
      <PartnerPage title={t("metaTitle")} back={back}>
        <PageError error={found.error} />
      </PartnerPage>
    );
  const payout = found.data;
  const documents =
    payout.status === "paid" && payout.remittanceAdviceAvailable
      ? await attempt(
          async () =>
            (await contract.GET("/v1/partner/factories/{factoryId}/payouts/{payoutId}/documents", { params: { path } }))
              .data!,
        )
      : null;
  const money = (amount: string, className = "tabular-nums") => <span className={className}>{format.thb(amount)}</span>;
  const links = documents?.data
    ? [
        { key: "remittance", label: t("docs.remittance"), url: documents.data.remittanceAdvice.url },
        ...documents.data.whtCertificates.flatMap((certificate) =>
          certificate.download
            ? [
                {
                  key: certificate.id,
                  label: t("docs.wht", { no: certificate.wtNumber }),
                  url: certificate.download.url,
                },
              ]
            : [],
        ),
      ]
    : [];

  const breakdown = [
    { key: "ap", term: t("apNet"), value: payout.apNetAmount },
    { key: "vat", term: t("vat"), value: payout.vatAmount },
    { key: "wht", term: t("wht"), value: payout.whtAmount },
    ...(payout.retentionAmount !== "0.00" ? [{ key: "ret", term: t("retention"), value: payout.retentionAmount }] : []),
    { key: "ded", term: t("deductions"), value: payout.claimDeductionAmount },
  ];
  return (
    <PartnerPage
      full
      title={payout.pvNumber ?? t("metaTitle")}
      back={back}
      status={<StatusChip map={PAYOUT_ITEM_STATUS} value={payout.status} size="md" />}
      description={`${tKinds(payout.kind)} · ${
        payout.paidOn
          ? t("paidTo", { date: format.date(payout.paidOn), last4: payout.bankAccountLast4 ?? "—" })
          : t("payOn", { date: format.date(payout.payOn) })
      }`}
    >
      <PartnerDetail
        aside={
          <ActionPanel id="payout-net" tone="neutral" title={t("net")}>
            <p className="text-[1.75rem] leading-tight font-semibold tracking-tight tabular-nums">
              {format.thb(payout.cashAmount)}
            </p>
            {payout.bankRef ? (
              <p className="text-muted text-sm">
                {t("bankRef")} <span className="text-fg tabular-nums">{payout.bankRef}</span>
              </p>
            ) : null}
            {documents ? (
              <div className="border-border flex flex-col gap-2 border-t pt-3">
                <p className="text-sm font-medium">{t("documents")}</p>
                {documents.data ? (
                  links.length ? (
                    <ul className="flex flex-col gap-2">
                      {links.map((item) => (
                        <li key={item.key}>
                          <ViewFile
                            src={item.url}
                            title={item.label}
                            className="border-border bg-surface hover:bg-surface-subtle text-fg flex min-h-11 w-full items-center gap-2 rounded-lg border px-3 py-2 text-start text-sm font-medium no-underline"
                          >
                            {item.label}
                          </ViewFile>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted text-sm">{t("documentsBody")}</p>
                  )
                ) : (
                  <PageError error={documents.error} />
                )}
              </div>
            ) : null}
          </ActionPanel>
        }
      >
        {payout.failureReason ? (
          <Callout tone="danger" title={t("failed")}>
            {payout.failureReason}
          </Callout>
        ) : null}
        <Card padding="md">
          <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-2">
            {breakdown.map((row) => (
              <div key={row.key} className="contents">
                <dt className="text-muted">{row.term}</dt>
                <dd className="text-end tabular-nums">{money(row.value)}</dd>
              </div>
            ))}
            <dt className="border-border border-t pt-2 font-semibold">{t("net")}</dt>
            <dd className="border-border border-t pt-2 text-end">
              {money(payout.cashAmount, "text-lg font-semibold tabular-nums")}
            </dd>
          </dl>
        </Card>
        <PartnerSection title={t("allocations")}>
          <ul className="border-border bg-surface divide-border divide-y rounded-xl border">
            {payout.allocations.map((item) => (
              <li key={item.payableId} className="flex flex-wrap items-baseline gap-2 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block">{tSources(item.source)}</span>
                  <span className="text-muted text-sm">
                    {[item.jobNo, item.poNumber, item.grNumber, item.bsNumber, item.orderCode]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className="font-medium tabular-nums">{format.thb(item.netAmount)}</span>
              </li>
            ))}
          </ul>
        </PartnerSection>
        {payout.claimDeductions.length ? (
          <PartnerSection title={t("claimDeductions")}>
            <ul className="border-border bg-surface divide-border divide-y rounded-xl border">
              {payout.claimDeductions.map((item, index) => (
                <li key={`${item.claimNo}-${index}`} className="flex justify-between gap-2 px-4 py-3 tabular-nums">
                  <span>{item.claimNo ?? "—"}</span>
                  <span className="font-medium">{format.thb(item.amount)}</span>
                </li>
              ))}
            </ul>
          </PartnerSection>
        ) : null}
        <PostedEntries sourceId={payout.id} />
      </PartnerDetail>
    </PartnerPage>
  );
}
