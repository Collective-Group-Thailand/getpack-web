import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CLAIM_STATUS } from "@/domain/status";
import { RespondClaim } from "@/features/partner/account/actions";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Icon } from "@/ui/icons";

type Props = { params: Promise<{ claimId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerAccount.claims"))("metaTitle") };
}

/**
 * One claim naming the factory: what the customer reported and the photos of the goods and the
 * carton (D-082), whose it is by D-083's rules, Packio's decision, the deductions — and the
 * factory's answer when Packio asks for one. Nothing identifies the customer (D-142).
 */
export default async function ClaimPage({ params }: Props) {
  const { claimId } = await params;
  const t = await getTranslations("partnerAccount.claims");
  const format = await getFormat();
  const context = await factoryContext();
  const { requests } = await partnerServerApis();
  const found = await attempt(() =>
    requests.call("GET /v1/partner/factories/{factoryId}/claims/{claimId}", {
      path: { factoryId: context.factoryId, claimId },
    }),
  );
  const back = { href: "/claims", label: t("back") };
  if (!found.data)
    return (
      <PartnerPage title={t("metaTitle")} back={back}>
        <PageError error={found.error} />
      </PartnerPage>
    );
  const claim = found.data;

  return (
    <PartnerPage
      title={claim.claimNo}
      back={back}
      meta={<StatusChip map={CLAIM_STATUS} value={claim.status} size="md" />}
      description={t(`types.${claim.type}`)}
    >
      {claim.responseDueAt ? (
        <Callout tone="warning" icon="warning" title={t("answerBy", { date: format.dateTime(claim.responseDueAt) })}>
          {t("answerBody")}
        </Callout>
      ) : null}
      <Card padding="md">
        <DescriptionList
          columns={1}
          items={[
            { term: t("reported"), description: claim.description },
            { term: t("resolution"), description: t(`resolutions.${claim.requestedResolution}`) },
            ...(claim.claimedQuantity !== null
              ? [{ term: t("quantity"), description: format.number(claim.claimedQuantity) }]
              : []),
            {
              term: t("reference"),
              description: [claim.job.jobNo, claim.shipmentNo].filter(Boolean).join(" · ") || "—",
            },
            { term: t("liability"), description: t(`liabilities.${claim.liability}`) },
            { term: t("submitted"), description: format.dateTime(claim.submittedAt) },
          ]}
        />
      </Card>

      {claim.evidence.length ? (
        <PartnerSection title={t("evidence")}>
          <ul className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {claim.evidence.map((item, index) => (
              <li key={`${item.file.id}-${index}`} className="flex flex-col gap-1">
                {item.file.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL
                  <img
                    src={item.file.thumbnailUrl}
                    alt={t("photoAlt", { role: t(`roles.${item.role}`), n: index + 1 })}
                    className="aspect-square w-full rounded-lg object-cover"
                  />
                ) : (
                  <span
                    className="bg-surface-subtle flex aspect-square items-center justify-center rounded-lg"
                    aria-hidden
                  >
                    <Icon name="image" size={32} className="text-muted" />
                  </span>
                )}
                <span className="text-muted text-sm">{t(`roles.${item.role}`)}</span>
              </li>
            ))}
          </ul>
        </PartnerSection>
      ) : null}

      {claim.factoryResponse ? (
        <PartnerSection title={t("yourAnswer")}>
          <Callout
            tone={claim.factoryResponse === "accepted" ? "info" : "warning"}
            title={t(`answers.${claim.factoryResponse}`)}
          >
            {claim.factoryNote}
            {claim.factoryRespondedAt ? (
              <span className="text-muted mt-1 block text-sm">{format.dateTime(claim.factoryRespondedAt)}</span>
            ) : null}
          </Callout>
        </PartnerSection>
      ) : null}
      {claim.decision ? (
        <PartnerSection title={t("decision")}>
          <p>{claim.decision}</p>
        </PartnerSection>
      ) : null}
      {claim.deductions.length ? (
        <PartnerSection title={t("deductions")}>
          <ul className="flex flex-col gap-1">
            {claim.deductions.map((item) => (
              <li key={item.id} className="flex justify-between gap-2 tabular-nums">
                <span>{item.appliedOn ? t("appliedOn", { date: format.date(item.appliedOn) }) : t("pending")}</span>
                <span className="font-medium">{format.thb(item.amount)}</span>
              </li>
            ))}
          </ul>
        </PartnerSection>
      ) : null}
      {claim.nextActions.includes("respond") ? (
        <PartnerSection title={t("respondTitle")}>
          <Card padding="lg">
            <RespondClaim claimId={claim.id} claimNo={claim.claimNo} />
          </Card>
        </PartnerSection>
      ) : null}
    </PartnerPage>
  );
}
