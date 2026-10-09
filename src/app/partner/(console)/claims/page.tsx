import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CLAIM_STATUS } from "@/domain/status";
import { offered } from "@/features/partner/account/offered";
import { attempt, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import type { Schemas } from "@/lib/api/types";
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
          <PartnerTable
            caption={t("title")}
            rows={rows}
            rowKey={(claim) => claim.id}
            rowHref={(claim) => `/claims/${claim.id}`}
            rowTone={(claim) => (waiting(claim) ? "danger" : undefined)}
            columns={[
              {
                key: "no",
                header: t("table.no"),
                primary: true,
                cell: (claim) => <span className="font-mono whitespace-nowrap">{claim.claimNo}</span>,
              },
              { key: "type", header: t("table.type"), cell: (claim) => t(`types.${claim.type}`) },
              {
                key: "refs",
                header: t("table.refs"),
                cell: (claim) => (
                  <span className="font-mono text-sm">
                    {[claim.jobNo, claim.shipmentNo].filter(Boolean).join(" · ")}
                  </span>
                ),
              },
              {
                key: "date",
                header: t("table.date"),
                cell: (claim) => format.date(claim.submittedAt),
                className: "whitespace-nowrap",
              },
              {
                key: "status",
                header: t("table.status"),
                cell: (claim) => (
                  <span className="flex flex-col items-start gap-1">
                    <StatusChip map={CLAIM_STATUS} value={claim.status} />
                    {waiting(claim) ? (
                      <span className="text-danger text-sm font-medium">{t("awaitingYou")}</span>
                    ) : null}
                  </span>
                ),
              },
              {
                key: "deduction",
                header: t("table.deduction"),
                align: "end",
                // The API names a recovered amount even when it is zero: show one only once there is a deduction.
                cell: (claim) => (claim.deductions.length ? format.thb(claim.deductionAmount) : "—"),
              },
            ]}
          />
        ) : (
          <EmptyState icon="shield" title={t("empty")} />
        )
      ) : (
        <PageError error={list.error} />
      )}
    </PartnerPage>
  );
}
