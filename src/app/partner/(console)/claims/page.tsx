import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { CLAIM_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { Badge } from "@/ui/components/Badge";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerAccount.claims"))("title") };
}

/** Claims that name the factory (D-082, D-083), the ones waiting for its answer first. */
export default async function ClaimsPage() {
  const t = await getTranslations("partnerAccount.claims");
  const format = await getFormat();
  const context = await factoryContext();
  const { requests } = await partnerServerApis();
  const list = await attempt(() =>
    requests.call("GET /v1/partner/factories/{factoryId}/claims", {
      path: { factoryId: context.factoryId },
      query: { perPage: 50 },
    }),
  );
  const rows = [...(list.data?.data ?? [])].sort((a, b) => Number(!!b.responseDueAt) - Number(!!a.responseDueAt));

  return (
    <PartnerPage title={t("title")} description={t("body")}>
      {list.data ? (
        rows.length ? (
          <ul className="flex flex-col gap-2">
            {rows.map((claim) => (
              <li key={claim.id}>
                <Link
                  href={`/claims/${claim.id}`}
                  className="border-border bg-surface hover:bg-surface-subtle flex min-h-20 flex-col gap-1 rounded-xl border p-3"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-semibold">{claim.claimNo}</span>
                    <StatusChip map={CLAIM_STATUS} value={claim.status} />
                    {claim.responseDueAt ? (
                      <Badge tone="warning" size="sm" icon="warning">
                        {t("awaitingYou")}
                      </Badge>
                    ) : null}
                    <Icon name="chevron-right" size={24} className="text-muted ms-auto" />
                  </span>
                  <span>{t(`types.${claim.type}`)}</span>
                  <span className="text-muted text-sm">
                    {[claim.job.jobNo, claim.shipmentNo, format.date(claim.submittedAt)].filter(Boolean).join(" · ")}
                    {claim.deduction ? ` · ${t("deduction", { amount: format.thb(claim.deduction) })}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon="shield" title={t("empty")} />
        )
      ) : (
        <PageError error={list.error} />
      )}
    </PartnerPage>
  );
}
