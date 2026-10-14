import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PAYOUT_ITEM_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PostedEntries } from "@/features/partner/ledger/PostedEntries";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { ViewFile } from "@/features/partner/viewer";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/partner/status";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";

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

  return (
    <PartnerPage
      title={payout.pvNumber ?? t("metaTitle")}
      back={back}
      meta={<StatusChip map={PAYOUT_ITEM_STATUS} value={payout.status} size="md" />}
      description={`${tKinds(payout.kind)} · ${
        payout.paidOn
          ? t("paidTo", { date: format.date(payout.paidOn), last4: payout.bankAccountLast4 ?? "—" })
          : t("payOn", { date: format.date(payout.payOn) })
      }`}
    >
      {payout.failureReason ? (
        <Callout tone="danger" title={t("failed")}>
          {payout.failureReason}
        </Callout>
      ) : null}
      <Card padding="md">
        <DescriptionList
          columns={1}
          items={[
            { term: t("apNet"), description: money(payout.apNetAmount) },
            { term: t("vat"), description: money(payout.vatAmount) },
            { term: t("wht"), description: money(payout.whtAmount) },
            ...(payout.retentionAmount !== "0.00"
              ? [{ term: t("retention"), description: money(payout.retentionAmount) }]
              : []),
            { term: t("deductions"), description: money(payout.claimDeductionAmount) },
            { term: t("net"), description: money(payout.cashAmount, "text-lg font-semibold tabular-nums") },
            ...(payout.bankRef ? [{ term: t("bankRef"), description: payout.bankRef }] : []),
          ]}
        />
      </Card>
      <PartnerSection title={t("allocations")}>
        <ul className="border-border divide-border divide-y rounded-xl border">
          {payout.allocations.map((item) => (
            <li key={item.payableId} className="flex flex-wrap items-baseline gap-2 p-3">
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
          <ul className="flex flex-col gap-1">
            {payout.claimDeductions.map((item, index) => (
              <li key={`${item.claimNo}-${index}`} className="flex justify-between gap-2 tabular-nums">
                <span>{item.claimNo ?? "—"}</span>
                <span className="font-medium">{format.thb(item.amount)}</span>
              </li>
            ))}
          </ul>
        </PartnerSection>
      ) : null}
      {documents ? (
        <PartnerSection title={t("documents")} description={t("documentsBody")}>
          {documents.data ? (
            <ul className="flex flex-col gap-2">
              {links.map((item) => (
                <li key={item.key}>
                  <ViewFile
                    src={item.url}
                    title={item.label}
                    className="border-border bg-surface hover:bg-surface-subtle text-fg flex w-full items-center gap-3 rounded-xl border p-3 text-start font-medium no-underline"
                  >
                    {item.label}
                  </ViewFile>
                </li>
              ))}
            </ul>
          ) : (
            <PageError error={documents.error} />
          )}
        </PartnerSection>
      ) : null}
      <PostedEntries sourceId={payout.id} />
    </PartnerPage>
  );
}
