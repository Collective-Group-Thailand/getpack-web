import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PAYOUT_ITEM_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Icon } from "@/ui/icons";

type Props = { params: Promise<{ payoutId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerBilling.payout"))("metaTitle") };
}

/** One payout: what it paid for, what was withheld and deducted, and its documents. */
export default async function PayoutPage({ params }: Props) {
  const { payoutId } = await params;
  const t = await getTranslations("partnerBilling.payout");
  const tKinds = await getTranslations("partnerBilling.payouts.allocations");
  const format = await getFormat();
  const context = await factoryContext();
  const { requests } = await partnerServerApis();
  const found = await attempt(() =>
    requests.call("GET /v1/partner/factories/{factoryId}/payouts/{payoutId}", {
      path: { factoryId: context.factoryId, payoutId },
    }),
  );
  const back = { href: "/payouts", label: t("back") };
  if (!found.data)
    return (
      <PartnerPage title={t("metaTitle")} back={back}>
        <PageError error={found.error} />
      </PartnerPage>
    );
  const payout = found.data;
  const documents = [
    payout.remittanceAdvice ? { key: "remittance", file: payout.remittanceAdvice } : null,
    payout.whtCertificate ? { key: "wht", file: payout.whtCertificate } : null,
  ].filter(
    (item): item is { key: "remittance" | "wht"; file: NonNullable<typeof payout.whtCertificate> } => item !== null,
  );

  return (
    <PartnerPage
      title={payout.pvNumber}
      back={back}
      meta={<StatusChip map={PAYOUT_ITEM_STATUS} value={payout.status} size="md" />}
      description={t("paidTo", { date: format.date(payout.paidOn), last4: payout.bankLast4 })}
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
            { term: t("gross"), description: <span className="tabular-nums">{format.thb(payout.gross)}</span> },
            { term: t("wht"), description: <span className="tabular-nums">{format.thb(payout.wht)}</span> },
            {
              term: t("deductions"),
              description: <span className="tabular-nums">{format.thb(payout.deductions)}</span>,
            },
            {
              term: t("net"),
              description: <span className="text-lg font-semibold tabular-nums">{format.thb(payout.net)}</span>,
            },
          ]}
        />
      </Card>
      <PartnerSection title={t("allocations")}>
        <ul className="border-border divide-border divide-y rounded-xl border">
          {payout.allocations.map((item, index) => (
            <li key={`${item.reference}-${index}`} className="flex flex-wrap items-baseline gap-2 p-3">
              <span className="flex-1">{tKinds(item.kind, { ref: item.reference })}</span>
              <span className="font-medium tabular-nums">{format.thb(item.amount)}</span>
            </li>
          ))}
        </ul>
      </PartnerSection>
      {documents.length ? (
        <PartnerSection title={t("documents")}>
          <ul className="flex flex-col gap-2">
            {documents.map((item) => (
              <li key={item.key}>
                <a
                  href={item.file.url ?? undefined}
                  download={item.file.originalName}
                  className="border-border bg-surface hover:bg-surface-subtle flex min-h-16 items-center gap-3 rounded-xl border p-3"
                >
                  <Icon name="download" size={24} className="text-primary" />
                  <span className="flex-1 font-medium">{t(`docs.${item.key}`)}</span>
                  <span className="text-muted text-sm">{item.file.originalName}</span>
                </a>
              </li>
            ))}
          </ul>
        </PartnerSection>
      ) : null}
    </PartnerPage>
  );
}
