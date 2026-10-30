import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { CLAIM_STATUS } from "@/domain/status";
import { offered } from "@/features/partner/account/offered";
import { attempt, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { ViewTabs } from "@/features/partner/rows";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/partner/status";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerAccount.claims"))("title") };
}

/**
 * Claims that name the factory (D-082, D-083, `partner.claims.list`, token-scoped — D-044), the ones
 * the API asks the factory to answer (`claim.respond`) first.
 */
export default async function ClaimsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [{ status: wanted }, t, tStatus, tNav, format] = await Promise.all([
    searchParams,
    getTranslations("partnerAccount.claims"),
    getTranslations("status"),
    getTranslations("partner.sidebar.items"),
    getFormat(),
  ]);
  const [tFactory, tAll] = await Promise.all([getTranslations("partner.status"), getTranslations("partnerJobs.views")]);
  const { contract } = await partnerServerApis();
  const list = await attempt(
    async () => (await contract.GET("/v1/partner/claims", { params: { query: { perPage: 50 } } })).data!,
  );
  const waiting = (claim: Schemas["PartnerClaimDto"]) => Boolean(offered(claim.nextActions, "claim.respond"));
  const all = [...(list.data?.data ?? [])].sort((a, b) => Number(waiting(b)) - Number(waiting(a)));
  // Tabs by what the claim asks of the factory, then by the statuses present — each with its count.
  const present = (Object.keys(CLAIM_STATUS) as (keyof typeof CLAIM_STATUS)[]).filter((status) =>
    all.some((claim) => claim.status === status),
  );
  const toAnswer = all.filter(waiting);
  const current =
    wanted === "awaiting" && toAnswer.length
      ? "awaiting"
      : wanted && present.includes(wanted as (typeof present)[number])
        ? wanted
        : "all";
  const rows =
    current === "awaiting" ? toAnswer : current === "all" ? all : all.filter((claim) => claim.status === current);
  const statusLabel = (status: string) => {
    const key = CLAIM_STATUS[status as keyof typeof CLAIM_STATUS].labelKey;
    return tFactory.has(key) ? tFactory(key) : tStatus(key);
  };

  return (
    <PartnerPage wide title={t("title")} description={t("body")}>
      {list.data && all.length ? (
        <ViewTabs
          label={t("title")}
          current={current}
          items={[
            { key: "all", href: "/claims", label: tAll("all"), count: all.length },
            ...(toAnswer.length
              ? [{ key: "awaiting", href: "/claims?status=awaiting", label: t("awaitingYou"), count: toAnswer.length }]
              : []),
            ...(present.length > 1
              ? present.map((status) => ({
                  key: status,
                  href: `/claims?status=${status}`,
                  label: statusLabel(status),
                  count: all.filter((claim) => claim.status === status).length,
                }))
              : []),
          ]}
        />
      ) : null}
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
                cell: (claim) => <span className="whitespace-nowrap tabular-nums">{claim.claimNo}</span>,
              },
              { key: "type", header: t("table.type"), cell: (claim) => t(`types.${claim.type}`) },
              {
                key: "refs",
                header: t("table.refs"),
                cell: (claim) => (
                  <span className="text-sm tabular-nums">
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
          <EmptyState
            icon="shield"
            title={t("empty")}
            action={
              <Button asChild variant="secondary" size="nav" iconEnd="arrow-right">
                <Link href="/jobs">{tNav("jobs")}</Link>
              </Button>
            }
          />
        )
      ) : (
        <PageError error={list.error} />
      )}
    </PartnerPage>
  );
}
