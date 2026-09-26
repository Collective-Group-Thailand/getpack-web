"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { CAMPAIGN_STATUS, PROMOTION_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { PageHeader } from "@/ui/components/PageHeader";
import { toast } from "@/ui/components/Toast";

import { ConfirmAction, FormDialog, problemMessage, QueryError, Section, StatusChip, useCan } from "../console";
import { BudgetMeter } from "./BudgetMeter";
import type { Campaign, PromotionSummary } from "./resources";
import { bangkokDayOf, bangkokMidnight } from "./time";

type Action = Campaign["allowedActions"][number];

/** Reads the campaign with its ETag: every change is sent under `If-Match`. */
export async function readCampaign(campaignId: string) {
  return browserRequests().read("GET /v1/admin/campaigns/{campaignId}", { path: { campaignId } });
}

/**
 * One campaign (F2 2.7, D-154): its budget against the alert threshold, what it has earned, the
 * promotions it groups, and the actions the API allows now. Ending a campaign ends its
 * promotions, so it restates the code and needs it retyped.
 */
export function CampaignDetail({ campaignId }: { campaignId: string }) {
  const t = useTranslations("marketing.campaign");
  const format = useFormat();
  const queryClient = useQueryClient();
  const canManage = useCan("marketing.manage");
  const key = queryKeys.detail("admin", "campaign", campaignId);
  const [action, setAction] = useState<Action | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: "", budgetAmount: "", startsOn: "", endsOn: "", goals: "" });

  const query = useQuery({ queryKey: key, queryFn: async () => (await readCampaign(campaignId)).data });
  const promotions = useQuery({
    queryKey: queryKeys.list("admin", "promotion", { campaignId }),
    queryFn: () => browserRequests().call("GET /v1/admin/promotions", { query: { campaignId, perPage: 100 } }),
  });
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const campaign = query.data;
  if (!campaign) return null;

  const settle = (updated: Campaign) => {
    queryClient.setQueryData(key, updated);
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "campaign") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "promotion") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.list("admin", "dashboard") });
  };

  const alerted = Number(campaign.spentPct) >= Number(campaign.alertThresholdPct);
  const columns: DataTableColumn<PromotionSummary>[] = [
    {
      id: "name",
      header: t("promotion"),
      cell: (row) => (
        <Link href={`/marketing/promotions/${row.id}`} className="text-primary font-medium hover:underline">
          {row.name}
        </Link>
      ),
    },
    { id: "kind", header: t("kind"), cell: (row) => t(`kinds.${row.kind}`) },
    { id: "benefit", header: t("benefit"), cell: (row) => row.benefitSummary },
    {
      id: "status",
      header: t("status"),
      cell: (row) => <StatusChip map={PROMOTION_STATUS} value={row.status} />,
    },
    { id: "used", header: t("used"), numeric: true, cell: (row) => format.number(row.usage.redemptionsCount) },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[{ label: t("campaigns"), href: "/marketing" }, { label: campaign.code }]}
          />
        }
        title={campaign.name}
        meta={
          <>
            <span className="text-muted font-mono text-sm">{campaign.code}</span>
            <StatusChip map={CAMPAIGN_STATUS} value={campaign.status} size="md" />
          </>
        }
        description={t("window", { from: format.date(campaign.startsAt), to: format.date(campaign.endsAt) })}
        actions={
          <>
            {canManage && campaign.status !== "ended" ? (
              <Button
                variant="secondary"
                iconStart="edit"
                onClick={() => {
                  setDraft({
                    name: campaign.name,
                    budgetAmount: campaign.budgetAmount,
                    startsOn: bangkokDayOf(campaign.startsAt),
                    endsOn: bangkokDayOf(campaign.endsAt),
                    goals: campaign.goals ?? "",
                  });
                  setEditing(true);
                }}
              >
                {t("edit")}
              </Button>
            ) : null}
            {campaign.allowedActions.map((item) => (
              <Button
                key={item}
                variant={item === "end" ? "ghost" : item === "activate" || item === "resume" ? "primary" : "secondary"}
                onClick={() => setAction(item)}
              >
                {t(`actions.${item}.label`)}
              </Button>
            ))}
          </>
        }
      />

      {campaign.alertedAt && alerted ? (
        <Callout
          tone={campaign.status === "exhausted" ? "danger" : "warning"}
          title={
            campaign.status === "exhausted"
              ? t("exhausted")
              : t("alerted", { threshold: format.percent(campaign.alertThresholdPct, 0) })
          }
        >
          <When at={campaign.alertedAt} />
        </Callout>
      ) : null}

      <Section title={t("budget")} description={t("budgetNote")}>
        <div className="max-w-xl">
          <BudgetMeter campaign={campaign} />
        </div>
      </Section>

      <Section title={t("performance")}>
        <dl className="grid gap-3 sm:grid-cols-5">
          {(
            [
              ["redemptions", format.number(campaign.performance.redemptionsCount)],
              ["orders", format.number(campaign.performance.ordersCount)],
              ["discount", format.thb(campaign.performance.discountAmount)],
              ["revenue", format.thb(campaign.performance.revenueAmount)],
              ["newCustomers", format.number(campaign.performance.newCustomersCount)],
            ] as const
          ).map(([name, value]) => (
            <div key={name} className="rounded-md border p-3">
              <dt className="text-muted text-xs">{t(`metrics.${name}`)}</dt>
              <dd className="text-lg font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        {campaign.goals ? (
          <p className="mt-3 text-sm">
            <Badge size="sm">{t("goals")}</Badge> {campaign.goals}
          </p>
        ) : null}
      </Section>

      <Section
        title={t("promotions")}
        actions={
          canManage && campaign.status !== "ended" ? (
            <Button size="sm" variant="secondary" iconStart="plus" asChild>
              <Link href={`/marketing/promotions/new?campaignId=${campaign.id}`}>{t("addPromotion")}</Link>
            </Button>
          ) : null
        }
      >
        <DataTable
          caption={t("promotions")}
          columns={columns}
          rows={promotions.data?.data ?? []}
          getRowId={(row) => row.id}
          loading={promotions.isPending}
          empty={<EmptyState icon="ticket" title={t("noPromotions")} />}
        />
      </Section>

      {action ? (
        <ConfirmAction
          open
          onOpenChange={(open) => (open ? undefined : setAction(null))}
          title={t(`actions.${action}.title`)}
          description={t(`actions.${action}.body`, {
            code: campaign.code,
            count: campaign.promotionsCount,
            spent: format.thb(campaign.spentAmount),
          })}
          confirmLabel={t(`actions.${action}.label`)}
          tone={action === "end" ? "destructive" : "primary"}
          confirmationPhrase={action === "end" ? campaign.code : undefined}
          reason={{ label: t("reason"), required: true, minLength: 3 }}
          onConfirm={async ({ reason }) => {
            try {
              const { etag } = await readCampaign(campaignId);
              const updated = await browserRequests().call("POST /v1/admin/campaigns/{campaignId}/actions/{action}", {
                path: { campaignId, action },
                body: { reason },
                etag: etag ?? undefined,
              });
              settle(updated);
              toast.success(t("changed"));
            } catch (error) {
              toast.error(problemMessage(error, t("failed")));
              throw error;
            }
          }}
        />
      ) : null}

      {editing ? (
        <FormDialog
          title={t("editTitle")}
          description={t("editBody", { code: campaign.code })}
          submitLabel={t("save")}
          onClose={() => setEditing(false)}
          onSubmit={async () => {
            const { etag } = await readCampaign(campaignId);
            const updated = await browserRequests().call("PATCH /v1/admin/campaigns/{campaignId}", {
              path: { campaignId },
              body: {
                name: draft.name.trim(),
                budgetAmount: Number(draft.budgetAmount).toFixed(2),
                startsAt: bangkokMidnight(draft.startsOn),
                endsAt: bangkokMidnight(draft.endsOn, true),
                goals: draft.goals.trim() || null,
              },
              etag: etag ?? undefined,
            });
            settle(updated);
            toast.success(t("saved"));
          }}
        >
          <Field label={t("fields.name")} required>
            <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          </Field>
          <Field
            label={t("fields.budget")}
            hint={t("fields.budgetHint", { spent: format.thb(campaign.spentAmount) })}
            required
          >
            <Input
              inputMode="decimal"
              value={draft.budgetAmount}
              onChange={(event) => setDraft({ ...draft, budgetAmount: event.target.value })}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("fields.startsOn")} required>
              <Input
                type="date"
                value={draft.startsOn}
                onChange={(event) => setDraft({ ...draft, startsOn: event.target.value })}
              />
            </Field>
            <Field label={t("fields.endsOn")} required>
              <Input
                type="date"
                value={draft.endsOn}
                onChange={(event) => setDraft({ ...draft, endsOn: event.target.value })}
              />
            </Field>
          </div>
          <Field label={t("fields.goals")}>
            <Textarea
              rows={3}
              value={draft.goals}
              onChange={(event) => setDraft({ ...draft, goals: event.target.value })}
            />
          </Field>
        </FormDialog>
      ) : null}
    </div>
  );
}
