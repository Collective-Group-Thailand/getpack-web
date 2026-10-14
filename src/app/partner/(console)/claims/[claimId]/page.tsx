import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CLAIM_STATUS } from "@/domain/status";
import { RespondClaim } from "@/features/partner/account/actions";
import { PartnerFileList } from "@/features/partner/account/files";
import { blockedReason, offered } from "@/features/partner/account/offered";
import { attempt, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { termsFrom, TermsHelp } from "@/features/partner/terms";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/partner/status";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";

type Props = { params: Promise<{ claimId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerAccount.claims"))("metaTitle") };
}

/**
 * One claim naming the factory (`partner.claims.get`): what the customer reported and the photos of
 * the goods and the carton (D-082), whose it is by D-083's rules, Packio's decision and what was
 * done, the deductions it caused — and the factory's answer when the API offers one
 * (`claim.respond`). Nothing identifies the customer (D-142).
 */
export default async function ClaimPage({ params }: Props) {
  const { claimId } = await params;
  const t = await getTranslations("partnerAccount.claims");
  const tProblems = await getTranslations("problems");
  const format = await getFormat();
  const tTerms = await getTranslations("partner.terms");
  const { contract } = await partnerServerApis();
  const found = await attempt(
    async () => (await contract.GET("/v1/partner/claims/{claimId}", { params: { path: { claimId } } })).data!,
  );
  const back = { href: "/claims", label: t("back") };
  if (!found.data)
    return (
      <PartnerPage title={t("metaTitle")} back={back}>
        <PageError error={found.error} />
      </PartnerPage>
    );
  const claim = found.data;
  const respond = offered(claim.nextActions, "claim.respond");
  const blocked = blockedReason(respond, tProblems);

  return (
    <PartnerPage
      title={claim.claimNo}
      back={back}
      meta={<StatusChip map={CLAIM_STATUS} value={claim.status} size="md" />}
      description={t(`types.${claim.type}`)}
    >
      {respond && !respond.disabledReason ? (
        <Callout tone={claim.sla.responseOverdue ? "danger" : "warning"} icon="warning" title={t("answerTitle")}>
          {claim.sla.responseDueAt
            ? claim.sla.responseOverdue
              ? t("answerOverdue", { at: format.dateTime(claim.sla.responseDueAt) })
              : `${t("answerBy", { at: format.dateTime(claim.sla.responseDueAt) })} — ${t("answerBody")}`
            : t("answerBody")}
        </Callout>
      ) : null}
      {blocked ? (
        <Callout tone="warning" icon="warning">
          {blocked}
        </Callout>
      ) : null}
      <Card padding="md">
        <DescriptionList
          columns={2}
          items={[
            { term: t("reported"), description: claim.description },
            { term: t("resolution"), description: t(`resolutions.${claim.requestedResolution}`) },
            ...(claim.claimedQuantity !== null
              ? [{ term: t("quantity"), description: format.number(claim.claimedQuantity) }]
              : []),
            ...(claim.claimedAmount ? [{ term: t("claimedAmount"), description: format.thb(claim.claimedAmount) }] : []),
            {
              term: t("reference"),
              description: (
                <span className="flex flex-wrap gap-x-2">
                  {claim.orderCode ? <span>{claim.orderCode}</span> : null}
                  {claim.jobId && claim.jobNo ? (
                    <Link href={`/jobs/${claim.jobId}`} className="text-primary underline underline-offset-2" aria-label={t("openJob", { no: claim.jobNo })}>
                      {claim.jobNo}
                    </Link>
                  ) : null}
                  {claim.shipmentNo ? <span>{claim.shipmentNo}</span> : null}
                </span>
              ),
            },
            { term: t("liability"), description: t(`liabilities.${claim.liability}`) },
            { term: t("submitted"), description: format.dateTime(claim.submittedAt) },
            { term: t("received"), description: format.dateTime(claim.receivedAt) },
          ]}
        />
      </Card>

      <TermsHelp title={tTerms("title")} terms={termsFrom(tTerms.raw, ["liability", "deduction", "claimWindow"])} />
      {claim.photos.product.length || claim.photos.carton.length ? (
        <PartnerSection title={t("evidence")}>
          <PartnerFileList fileIds={claim.photos.product} label={t("roles.product")} />
          <PartnerFileList fileIds={claim.photos.carton} label={t("roles.carton")} />
        </PartnerSection>
      ) : null}

      {claim.infoRequest ? (
        <PartnerSection title={t("infoRequest")}>
          <p>{claim.infoRequest}</p>
        </PartnerSection>
      ) : null}

      {claim.factoryResponse ? (
        <PartnerSection title={t("yourAnswer")}>
          <Callout
            tone={claim.factoryResponse === "accepted" ? "info" : "warning"}
            title={t(`answers.${claim.factoryResponse}`)}
          >
            {claim.factoryResponseNote}
            {claim.factoryRespondedAt ? (
              <span className="text-muted mt-1 block text-sm">{format.dateTime(claim.factoryRespondedAt)}</span>
            ) : null}
          </Callout>
          <PartnerFileList fileIds={claim.factoryEvidenceFileIds} label={t("roles.factory")} />
        </PartnerSection>
      ) : null}
      {claim.decisionNote ? (
        <PartnerSection title={t("decision")}>
          <p>{claim.decisionNote}</p>
        </PartnerSection>
      ) : null}
      {claim.resolutions.length ? (
        <PartnerSection title={t("resolutionsTitle")}>
          <ul className="flex flex-col gap-1 text-sm">
            {claim.resolutions.map((item, index) => (
              <li key={`${item.action}-${index}`} className="flex flex-wrap justify-between gap-2">
                <span>
                  {t(`actions.${item.action}`)}
                  {item.jobNo ? ` · ${item.jobNo}` : ""}
                  {item.quantity !== null ? ` · ${t("pieces", { quantity: format.number(item.quantity) })}` : ""}
                </span>
                <span className="text-muted">
                  {item.amount ? `${format.thb(item.amount)} · ` : ""}
                  {format.date(item.executedAt)}
                </span>
              </li>
            ))}
          </ul>
        </PartnerSection>
      ) : null}
      {claim.deductions.length ? (
        <PartnerSection
          title={t("deductions")}
          description={t("deductionTotal", { amount: format.thb(claim.deductionAmount) })}
        >
          <ul className="flex flex-col gap-1">
            {claim.deductions.map((item) => (
              <li key={item.id} className="flex flex-wrap justify-between gap-2 tabular-nums">
                <span>
                  {t(`deductionStatus.${item.status}`)} · {t(`offsets.${item.offsetAgainst}`)} ·{" "}
                  {format.date(item.recordedAt)}
                </span>
                <span className="font-medium">{format.thb(item.amount)}</span>
              </li>
            ))}
          </ul>
        </PartnerSection>
      ) : null}
      {respond && !respond.disabledReason ? (
        <PartnerSection title={t("respondTitle")}>
          <Card padding="md">
            <RespondClaim claimId={claim.id} claimNo={claim.claimNo} />
          </Card>
        </PartnerSection>
      ) : null}
    </PartnerPage>
  );
}
