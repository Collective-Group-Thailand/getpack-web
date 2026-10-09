import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PROPOSAL_STATUS } from "@/domain/status";
import { PartnerFileButton } from "@/features/partner/account/files";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { CounterAnswers, EvidenceUpload, SubmitProposal, WithdrawProposal } from "@/features/partner/prices/actions";
import { LineList, lineLabeller } from "@/features/partner/prices/LineList";
import { ProposalEditor } from "@/features/partner/prices/ProposalEditor";
import { RateCardReview } from "@/features/partner/prices/RateCardReview";
import { loadPrices, OPEN_PROPOSAL } from "@/features/partner/prices/server";
import { columnsOf, type Values } from "@/features/partner/prices/values";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";

type Props = { params: Promise<{ proposalId: string }>; searchParams: Promise<{ component?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerPrices.proposal"))("metaTitle") };
}

/**
 * One proposal — the factory's own (D-042 b), or a rate card Packio sent (D-042 a) — with what
 * the factory can do at its stage: build and submit a draft, attach evidence, withdraw, answer
 * Packio's counters, or accept a rate card whole or line by line.
 */
export default async function ProposalPage({ params, searchParams }: Props) {
  const [{ proposalId }, query] = await Promise.all([params, searchParams]);
  const t = await getTranslations("partnerPrices.proposal");
  const format = await getFormat();
  const context = await factoryContext();
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId, proposalId };
  const [proposal, prices] = await Promise.all([
    attempt(
      async () =>
        (await contract.GET("/v1/partner/factories/{factoryId}/price-proposals/{proposalId}", { params: { path } }))
          .data!,
    ),
    loadPrices(context.factoryId),
  ]);
  const back = { href: "/prices", label: t("back") };
  if (!proposal.data)
    return (
      <PartnerPage title={t("metaTitle")} back={back}>
        <PageError error={proposal.error} />
      </PartnerPage>
    );
  const item = proposal.data;
  const name = prices.typeName(item.productTypeId);
  const factoryOwn = item.direction === "factory_to_packio";
  const label = await lineLabeller(prices.components, prices.references);
  const evidence = factoryOwn
    ? await attempt(
        async () =>
          (
            await contract.GET("/v1/partner/factories/{factoryId}/price-proposals/{proposalId}/evidence", {
              params: { path },
            })
          ).data ?? [],
      )
    : null;
  const list = prices.lists.data?.find((candidate) => candidate.id === item.priceListId);

  return (
    <PartnerPage
      full
      title={factoryOwn ? t("titleOwn", { type: name }) : t("titleRateCard", { type: name })}
      back={back}
      meta={<StatusChip map={PROPOSAL_STATUS} value={item.status} size="md" />}
      description={t("meta", {
        from: format.date(item.proposedEffectiveFrom),
        base: item.baseVersionNo ?? 0,
        lines: item.lineCounts.total,
      })}
    >
      {item.comment ? (
        <Callout tone="neutral" title={factoryOwn ? t("reasonOwn") : t("reasonPackio")}>
          {item.comment}
        </Callout>
      ) : null}
      {item.resultingVersion ? (
        <Callout tone="success" icon="check" title={t("resultingTitle", { version: item.resultingVersion.versionNo })}>
          {t("resultingBody", { date: format.date(item.proposedEffectiveFrom) })}
        </Callout>
      ) : null}

      {factoryOwn && item.status === "draft" ? (
        <>
          <PartnerSection title={t("draftTitle")} description={t("draftBody")}>
            <ProposalEditor
              proposalId={item.id}
              versionId={list?.current?.id ?? null}
              productTypeCode={list?.productTypeCode ?? null}
              initialComponent={query.component}
              definitions={prices.components}
              references={prices.references}
              lines={item.lines}
            />
          </PartnerSection>
        </>
      ) : (
        <PartnerSection title={t("linesTitle")}>
          <LineList lines={item.lines} definitions={prices.components} references={prices.references} />
        </PartnerSection>
      )}

      {factoryOwn && item.status === "countered" ? (
        <PartnerSection title={t("countersTitle")} description={t("countersBody")}>
          <Card padding="lg">
            <CounterAnswers
              proposalId={item.id}
              lines={item.lines
                .filter((line) => line.decision === "countered")
                .map((line) => ({
                  id: line.id,
                  label: `${label.title(line)} — ${label.values(line.component, line.counterValues as Values | null)}`,
                }))}
            />
          </Card>
        </PartnerSection>
      ) : null}

      {!factoryOwn && ["submitted", "under_review"].includes(item.status) ? (
        <PartnerSection
          title={t("answerTitle")}
          description={t("answerBody", { date: format.date(item.proposedEffectiveFrom) })}
        >
          <RateCardReview
            proposalId={item.id}
            typeName={name}
            lines={item.lines
              .filter((line) => line.decision === "pending")
              .map((line) => ({
                id: line.id,
                label: label.title(line),
                proposed: label.values(line.component, line.proposedValues as Values | null),
                columns: columnsOf(prices.components, line.component).values.map((column) => ({
                  key: column.key,
                  label: label.column(column.key),
                  value: String((line.proposedValues as Values | null)?.[column.key] ?? ""),
                })),
              }))}
          />
        </PartnerSection>
      ) : null}

      {factoryOwn ? (
        <PartnerSection title={t("evidenceTitle")} description={t("evidenceBody")}>
          {evidence?.data?.length ? (
            <ul className="flex flex-col gap-1">
              {evidence.data.map((file) => (
                <li key={file.fileId} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1">
                    {t("evidenceItem", {
                      name: file.fileName,
                      by: file.addedBy?.displayName ?? "—",
                      date: format.date(file.addedAt),
                    })}
                    {file.note ? ` — ${file.note}` : ""}
                  </span>
                  <PartnerFileButton fileId={file.fileId} label={t("evidenceOpen")} size="md" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted text-sm">{t("evidenceEmpty")}</p>
          )}
          {OPEN_PROPOSAL.includes(item.status) ? (
            <Card padding="lg">
              <EvidenceUpload proposalId={item.id} />
            </Card>
          ) : null}
        </PartnerSection>
      ) : null}

      {factoryOwn && item.status === "draft" ? (
        <PartnerSection title={t("sendTitle")} description={t("sendBody")}>
          <Card padding="lg" className="flex flex-col gap-3">
            <SubmitProposal proposalId={item.id} typeName={name} lines={item.lines.length} />
          </Card>
        </PartnerSection>
      ) : null}

      {factoryOwn && OPEN_PROPOSAL.includes(item.status) ? (
        <PartnerSection title={t("withdrawTitle")}>
          <WithdrawProposal proposalId={item.id} typeName={name} />
        </PartnerSection>
      ) : null}
    </PartnerPage>
  );
}
