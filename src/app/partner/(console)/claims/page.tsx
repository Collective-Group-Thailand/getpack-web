import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CLAIM_STATUS } from "@/domain/status";
import { offered } from "@/features/partner/account/offered";
import { attempt, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { Code, Row, RowList } from "@/features/partner/rows";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerAccount.claims"))("title") };
}

/**
 * Claims that name the factory (D-082, D-083, `partner.claims.list`, token-scoped — D-044), the ones
 * the API asks the factory to answer (`claim.respond`) first.
 */
export default async function ClaimsPage() {
  const t = await getTranslations("partnerAccount.claims");
  const format = await getFormat();
  const { contract } = await partnerServerApis();
  const list = await attempt(
    async () => (await contract.GET("/v1/partner/claims", { params: { query: { perPage: 50 } } })).data!,
  );
  const waiting = (claim: Schemas["PartnerClaimDto"]) => Boolean(offered(claim.nextActions, "claim.respond"));
  const rows = [...(list.data?.data ?? [])].sort((a, b) => Number(waiting(b)) - Number(waiting(a)));

  return (
    <PartnerPage wide title={t("title")} description={t("body")}>
      {list.data ? (
        rows.length ? (
          <RowList label={t("title")}>
            {rows.map((claim) => (
              <Row
                key={claim.id}
                href={`/claims/${claim.id}`}
                icon="shield-alert"
                tone={waiting(claim) ? "danger" : "neutral"}
                title={
                  <>
                    <Code>{claim.claimNo}</Code>
                    <StatusChip map={CLAIM_STATUS} value={claim.status} />
                    {waiting(claim) ? (
                      <Badge tone="warning" size="sm" icon="warning">
                        {t("awaitingYou")}
                      </Badge>
                    ) : null}
                  </>
                }
                meta={
                  <>
                    <span className="text-fg">{t(`types.${claim.type}`)}</span>
                    {" · "}
                    {[claim.jobNo, claim.shipmentNo, format.date(claim.submittedAt)].filter(Boolean).join(" · ")}
                  </>
                }
                // The API names a recovered amount even when it is zero: show one only once there is a deduction.
                aside={
                  claim.deductions.length ? (
                    <span className="font-semibold">
                      {t("deduction", { amount: format.thb(claim.deductionAmount) })}
                    </span>
                  ) : undefined
                }
              />
            ))}
          </RowList>
        ) : (
          <EmptyState icon="shield" title={t("empty")} />
        )
      ) : (
        <PageError error={list.error} />
      )}
    </PartnerPage>
  );
}
