"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { REFERRAL_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Dialog } from "@/ui/components/Dialog";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import type { DataTableColumn } from "@/ui/components/DataTable";

import { adminBrowserApis, QueryError, QueueTabs, ResourceList, StatusChip, type InitialPage } from "../console";
import { REFERRAL_STATUSES, referralsList, type Referral } from "./resources";

/**
 * Referrals (F2 2.7, D-136). The referrer is rewarded only after the referee's first order
 * passes the claim window; one that matches the referrer's phone, address, card or device, or
 * passes the monthly cap, is held and opens a `referral_review` approval — Marketing decides it
 * in the approvals inbox, and the referral follows.
 *
 * The published row names the first order's **group** by code, with neither its amount nor its
 * claim window, carries no reward points, and its fraud flags are free text (CONTRACT-GAP
 * admin.referrals).
 */
export function ReferralsQueue({ initial }: { initial: InitialPage<Referral> | null }) {
  const t = useTranslations("marketing.referrals");
  const tStatus = useTranslations("status");
  const [shown, setShown] = useState<string | null>(null);

  const person = (ref: Referral["referrer"]) => (
    <div className="min-w-0">
      <Link href={`/customers/${ref.id}`} className="text-primary hover:underline">
        {ref.displayName}
      </Link>
    </div>
  );

  const columns: DataTableColumn<Referral>[] = [
    { id: "referrer", header: t("columns.referrer"), cell: (row) => person(row.referrer) },
    { id: "referee", header: t("columns.referee"), cell: (row) => person(row.referee) },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={REFERRAL_STATUS} value={row.status} />,
    },
    {
      id: "flags",
      header: t("columns.flags"),
      cell: (row) =>
        row.fraudFlags.length ? (
          <ul className="flex flex-wrap gap-1">
            {row.fraudFlags.map((flag) => (
              <li key={flag}>
                <Badge tone="warning" size="sm" icon="shield-alert">
                  {t.has(`flags.${flag}`) ? t(`flags.${flag}`) : flag}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-muted">–</span>
        ),
    },
    {
      id: "firstOrder",
      header: t("columns.firstOrder"),
      cell: (row) =>
        row.firstOrderGroupId && row.firstOrderGroupCode ? (
          <Link href={`/orders/groups/${row.firstOrderGroupId}`} className="text-primary font-mono hover:underline">
            {row.firstOrderGroupCode}
          </Link>
        ) : (
          <span className="text-muted text-sm">{t("noOrder")}</span>
        ),
    },
    {
      id: "attributedAt",
      header: t("columns.attributed"),
      hideable: true,
      cell: (row) => <When at={row.attributedAt} />,
    },
    {
      id: "review",
      header: <span className="sr-only">{t("review")}</span>,
      cell: (row) => (
        <div className="flex gap-1">
          {row.status === "under_review" && row.approvalId ? (
            <Button size="sm" variant="secondary" asChild>
              <Link href={`/approvals/${row.approvalId}`}>{t("reviewFor", { code: row.referee.displayName })}</Link>
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => setShown(row.id)}>
            {t("details")}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <QueueTabs
        label={t("statusesLabel")}
        param="status"
        tabs={[
          { value: null, label: t("all") },
          ...REFERRAL_STATUSES.map((status) => ({
            value: status,
            label: tStatus(REFERRAL_STATUS[status].labelKey),
            ...(status === "under_review" ? { countKey: "marketing.referral_review" } : {}),
          })),
        ]}
      />
      <ResourceList
        resource={referralsList}
        columns={columns}
        caption={t("title")}
        initial={initial}
        rowTone={(row) => (row.status === "under_review" ? "warning" : undefined)}
        empty={{ title: t("empty") }}
      />
      {shown ? <ReferralDetail referralId={shown} onClose={() => setShown(null)} /> : null}
    </div>
  );
}

/** One referral read fresh (`admin.referrals.get`, D-136): when each step happened and the reward. */
function ReferralDetail({ referralId, onClose }: { referralId: string; onClose: () => void }) {
  const t = useTranslations("marketing.referrals.detail");
  const tFlags = useTranslations("marketing.referrals");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const referral = useQuery({
    queryKey: queryKeys.detail("admin", "referral", referralId),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/referrals/{referralId}", { params: { path: { referralId } } }))
        .data!,
  });
  const data = referral.data;
  return (
    <Dialog
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={t("title", { code: data?.code ?? "" })}
      closeLabel={tCommon("actions.close")}
    >
      {referral.isError ? <QueryError error={referral.error} onRetry={() => void referral.refetch()} /> : null}
      {data ? (
        <div className="flex flex-col gap-3">
          <DescriptionList
            columns={2}
            items={[
              { term: t("referrer"), description: data.referrer.displayName },
              { term: t("referee"), description: data.referee.displayName },
              { term: t("status"), description: <StatusChip map={REFERRAL_STATUS} value={data.status} /> },
              { term: t("reward"), description: t("points", { points: format.number(data.rewardPoints) }) },
              { term: t("attributedAt"), description: <When at={data.attributedAt} /> },
              { term: t("qualifiedAt"), description: data.qualifiedAt ? <When at={data.qualifiedAt} /> : "–" },
              { term: t("rewardedAt"), description: data.rewardedAt ? <When at={data.rewardedAt} /> : "–" },
              { term: t("decidedAt"), description: data.decidedAt ? <When at={data.decidedAt} /> : "–" },
              {
                term: t("firstOrder"),
                description: data.firstOrderGroupCode
                  ? `${data.firstOrderGroupCode} · ${format.thb(data.firstOrderGrossAmount)}`
                  : "–",
              },
              {
                term: t("claimWindow"),
                description: data.firstOrderClaimWindowEndsAt ? (
                  <When at={data.firstOrderClaimWindowEndsAt} absoluteOnly />
                ) : (
                  "–"
                ),
              },
            ]}
          />
          {data.fraudFlags.length ? (
            <p className="text-sm">
              {t("flags")}:{" "}
              {data.fraudFlags.map((flag) => (tFlags.has(`flags.${flag}`) ? tFlags(`flags.${flag}`) : flag)).join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}
    </Dialog>
  );
}
