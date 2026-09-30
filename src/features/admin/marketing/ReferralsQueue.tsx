"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { REFERRAL_STATUS } from "@/domain/status";
import { When } from "@/features/shared/format";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import type { DataTableColumn } from "@/ui/components/DataTable";

import { QueueTabs, ResourceList, StatusChip, type InitialPage } from "../console";
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
      cell: (row) =>
        row.status === "under_review" && row.approvalId ? (
          <Button size="sm" variant="secondary" asChild>
            <Link href={`/approvals/${row.approvalId}`}>{t("reviewFor", { code: row.referee.displayName })}</Link>
          </Button>
        ) : null,
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
    </div>
  );
}
