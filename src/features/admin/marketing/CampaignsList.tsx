"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { z } from "zod";

import { CAMPAIGN_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { Badge } from "@/ui/components/Badge";
import type { DataTableColumn } from "@/ui/components/DataTable";

import { CrudList, defineResource, QueueTabs, StatusChip, type FieldDef, type InitialPage } from "../console";
import { BudgetMeter } from "./BudgetMeter";
import { CAMPAIGN_STATUSES, campaignsList, type CampaignSummary } from "./resources";
import { bangkokMidnight } from "./time";

const schema = z.object({
  code: z.string().regex(/^[A-Z0-9][A-Z0-9_-]{2,39}$/, "code"),
  name: z.string().trim().min(1, "required"),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "required"),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "required"),
  budgetAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "amount"),
  goals: z.string().optional(),
});
type Values = z.infer<typeof schema>;

const config = defineResource<CampaignSummary, Values>({
  list: campaignsList,
  manage: "marketing.manage",
  form: {
    schema,
    empty: { code: "", name: "", startsOn: "", endsOn: "", budgetAmount: "", goals: "" },
    toValues: (row) => ({
      code: row.code,
      name: row.name,
      startsOn: row.startsAt.slice(0, 10),
      endsOn: row.endsAt.slice(0, 10),
      budgetAmount: row.budgetAmount,
      goals: "",
    }),
    create: ({ requests }, values) =>
      requests.call("POST /v1/admin/campaigns", {
        body: {
          code: values.code,
          name: values.name.trim(),
          startsAt: bangkokMidnight(values.startsOn),
          endsAt: bangkokMidnight(values.endsOn, true),
          budgetAmount: Number(values.budgetAmount).toFixed(2),
          goals: values.goals?.trim() || null,
        },
      }),
  },
});

/**
 * Campaigns (F2 2.7, D-053, D-154): a time-boxed THB budget grouping promotions. Each row shows
 * how much of the budget is spent against the alert threshold the API reports — the setting
 * `campaigns.budget_alert_pct` — and the API stops a campaign whose budget runs out.
 */
export function CampaignsList({ initial }: { initial: InitialPage<CampaignSummary> | null }) {
  const t = useTranslations("marketing.campaigns");
  const tStatus = useTranslations("status");
  const format = useFormat();

  const columns: DataTableColumn<CampaignSummary>[] = [
    {
      id: "code",
      header: t("columns.campaign"),
      cell: (row) => (
        <div className="min-w-0">
          <Link href={`/marketing/campaigns/${row.id}`} className="text-primary font-medium hover:underline">
            {row.name}
          </Link>
          <p className="text-muted font-mono text-xs">{row.code}</p>
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
        <div className="w-48">
          <BudgetMeter campaign={row} compact />
        </div>
      ),
    },
    {
      id: "window",
      header: t("columns.window"),
      cell: (row) => (
        <span className="text-sm whitespace-nowrap">
          {format.date(row.startsAt)} – {format.date(row.endsAt)}
        </span>
      ),
    },
    {
      id: "promotions",
      header: t("columns.promotions"),
      numeric: true,
      cell: (row) => row.promotionsCount,
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
    { name: "budgetAmount", label: t("fields.budget"), kind: "text", required: true, hint: t("hints.budget") },
    { name: "startsOn", label: t("fields.startsOn"), kind: "date", required: true },
    { name: "endsOn", label: t("fields.endsOn"), kind: "date", required: true },
    { name: "goals", label: t("fields.goals"), kind: "textarea", wide: true },
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
