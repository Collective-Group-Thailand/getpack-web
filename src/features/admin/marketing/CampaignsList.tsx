"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { z } from "zod";

import { CAMPAIGN_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { Badge } from "@/ui/components/Badge";
import type { DataTableColumn } from "@/ui/components/DataTable";

import { CrudList, defineResource, QueueTabs, StatusChip, type FieldDef, type InitialPage } from "../console";
import { CampaignBudget } from "./CampaignBudget";
import { CAMPAIGN_STATUSES, campaignsList, type Campaign } from "./resources";
import { bangkokDayOf, bangkokMidnight } from "./time";

const day = /^\d{4}-\d{2}-\d{2}$/;
const schema = z.object({
  // `CreateCampaignDto.code`: lower case, digits, `-` or `_`, 2–40 long.
  code: z.string().regex(/^[a-z0-9][a-z0-9_-]{1,39}$/, "code"),
  name: z.string().trim().min(1, "required"),
  startsOn: z.string().regex(day, "required"),
  endsOn: z.string().regex(day).or(z.literal("")),
  budgetAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "amount")
    .or(z.literal("")),
});
type Values = z.infer<typeof schema>;

const config = defineResource<Campaign, Values>({
  list: campaignsList,
  manage: "campaigns.manage",
  form: {
    schema,
    empty: { code: "", name: "", startsOn: "", endsOn: "", budgetAmount: "" },
    toValues: (row) => ({
      code: row.code,
      name: row.name,
      startsOn: bangkokDayOf(row.startsAt),
      endsOn: bangkokDayOf(row.endsAt),
      budgetAmount: row.budgetAmount ?? "",
    }),
    // Goals are a free map on the contract (`goals: { … }`) with no documented keys, so the form
    // does not write them; the campaign page shows what the API holds.
    create: async ({ contract }, values) =>
      (
        await contract.POST("/v1/admin/campaigns", {
          body: {
            code: values.code,
            name: values.name.trim(),
            startsAt: bangkokMidnight(values.startsOn),
            endsAt: values.endsOn ? bangkokMidnight(values.endsOn, true) : null,
            budgetAmount: values.budgetAmount ? Number(values.budgetAmount).toFixed(2) : null,
          },
        })
      ).data!,
  },
});

/**
 * Campaigns (F2 2.7, D-053, D-154): a time-boxed THB budget grouping promotions. Each row shows
 * the budget spent and the alert threshold the API reports — the setting
 * `campaigns.budget_alert_pct` — and the API stops a campaign whose budget runs out.
 *
 * Each row has the spend gauge (`spentPct`), how many promotions the campaign holds, who created
 * it and when.
 */
export function CampaignsList({ initial }: { initial: InitialPage<Campaign> | null }) {
  const t = useTranslations("marketing.campaigns");
  const tStatus = useTranslations("status");
  const format = useFormat();

  const columns: DataTableColumn<Campaign>[] = [
    {
      id: "code",
      header: t("columns.campaign"),
      cell: (row) => (
        <div className="min-w-0">
          <Link href={`/marketing/campaigns/${row.id}`} className="text-primary font-medium hover:underline">
            {row.name}
          </Link>
          <p className="text-muted text-xs tabular-nums">{row.code}</p>
        </div>
      ),
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={CAMPAIGN_STATUS} value={row.status} />,
    },
    {
      id: "budget",
      header: t("columns.budget"),
      cell: (row) => (
        <div className="w-56">
          <CampaignBudget campaign={row} compact />
        </div>
      ),
    },
    {
      id: "promotions",
      header: t("columns.promotions"),
      numeric: true,
      cell: (row) => (
        <Link href={`/marketing/promotions?campaignId=${row.id}`} className="text-primary hover:underline">
          {format.number(row.promotionsCount)}
        </Link>
      ),
    },
    {
      id: "owner",
      header: t("columns.owner"),
      hideable: true,
      cell: (row) => (
        <div className="min-w-0 text-sm">
          <p className="truncate">{row.owner?.displayName ?? "–"}</p>
          <p className="text-muted text-xs">
            <When at={row.createdAt} />
          </p>
        </div>
      ),
    },
    {
      id: "window",
      header: t("columns.window"),
      cell: (row) => (
        <span className="text-sm whitespace-nowrap">
          {format.date(row.startsAt)} – {row.endsAt ? format.date(row.endsAt) : t("noEnd")}
        </span>
      ),
    },
    {
      id: "alert",
      header: t("columns.alert"),
      hideable: true,
      cell: (row) =>
        row.alertedAt ? (
          <Badge tone="warning" icon="warning" size="sm">
            {t("alerted")} <When at={row.alertedAt} />
          </Badge>
        ) : (
          <span className="text-muted">–</span>
        ),
    },
  ];

  const fields: FieldDef<Values>[] = [
    { name: "name", label: t("fields.name"), kind: "text", required: true, wide: true },
    { name: "code", label: t("fields.code"), kind: "text", required: true, hint: t("hints.code") },
    { name: "budgetAmount", label: t("fields.budget"), kind: "text", hint: t("hints.budget") },
    { name: "startsOn", label: t("fields.startsOn"), kind: "date", required: true },
    { name: "endsOn", label: t("fields.endsOn"), kind: "date", hint: t("hints.endsOn") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <QueueTabs
        label={t("statusesLabel")}
        param="status"
        tabs={[
          { value: null, label: t("all"), countKey: "marketing.budget_alerts" },
          ...CAMPAIGN_STATUSES.map((status) => ({ value: status, label: tStatus(CAMPAIGN_STATUS[status].labelKey) })),
        ]}
      />
      <CrudList
        config={config}
        columns={columns}
        caption={t("title")}
        fields={fields}
        searchLabel={t("search")}
        initial={initial}
        labels={{ create: t("create"), createTitle: t("createTitle"), empty: t("empty") }}
      />
    </div>
  );
}
