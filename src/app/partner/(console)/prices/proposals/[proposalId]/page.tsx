import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PROPOSAL_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { CounterAnswers, EvidenceUpload, SubmitProposal, WithdrawProposal } from "@/features/partner/prices/actions";
import { lineToInput } from "@/features/partner/prices/lines";
import { LineList, lineLabeller } from "@/features/partner/prices/LineList";
import { ProposalEditor } from "@/features/partner/prices/ProposalEditor";
import { RateCardReview } from "@/features/partner/prices/RateCardReview";
import { loadPrices, OPEN_PROPOSAL } from "@/features/partner/prices/server";
import { columnsOf, type Values } from "@/features/partner/prices/values";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";

type Props = { params: Promise<{ proposalId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerPrices.proposal"))("metaTitle") };
}

/**
 * One proposal — the factory's own (D-042 b), or a rate card Packio sent (D-042 a) — with what
 * the factory can do at its stage: build and submit a draft, attach evidence, withdraw, answer
 * Packio's counters, or accept a rate card whole or line by line.
 */
export default async function ProposalPage({ params }: Props) {
  const { proposalId } = await params;
  const t = await getTranslations("partnerPrices.proposal");
  const format = await getFormat();
  const context = await factoryContext();
  const { contract, requests } = await partnerServerApis();
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
    ? await attempt(() =>
        requests.call("GET /v1/partner/factories/{factoryId}/price-proposals/{proposalId}/evidence", { path }),
      )
    : null;
  const list = prices.lists.data?.find((candidate) => candidate.id === item.priceListId);

  return (
    <PartnerPage
      title={factoryOwn ? t("titleOwn", { type: name }) : t("titleRateCard", { type: name })}
      back={back}
      meta={<StatusChip map={PROPOSAL_STATUS} value={item.status} size="md" />}
      description={t("meta", {
        from: format.date(item.proposedEffectiveFrom),
        base: item.baseVersionNo ?? 0,
        lines: item.lineCounts.total,
      })}
      wide
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
              definitions={prices.components}
              references={prices.references}
              draft={item.lines.map((line) => ({
                input: lineToInput(line),
                label: `${t(`actions.${line.action}`)} · ${label.title(line)}`,
                summary: label.values(line.component, (line.proposedValues ?? line.currentValues) as Values | null),
              }))}
            />
          </PartnerSection>
          <PartnerSection title={t("sendTitle")} description={t("sendBody")}>
            <SubmitProposal proposalId={item.id} typeName={name} lines={item.lines.length} />
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
                <li key={file.id} className="text-sm">
                  {t("evidenceItem", {
                    name: file.originalName,
                    by: file.createdBy.displayName,
                    date: format.date(file.createdAt),
                  })}
                  {file.note ? ` — ${file.note}` : ""}
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

      {factoryOwn && OPEN_PROPOSAL.includes(item.status) ? (
        <PartnerSection title={t("withdrawTitle")}>
          <WithdrawProposal proposalId={item.id} typeName={name} />
        </PartnerSection>
      ) : null}
    </PartnerPage>
  );
}
