"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { adminCampaignActions, type AdminLifecycleAction } from "@/domain/next-actions/admin";
import { CAMPAIGN_STATUS, PROMOTION_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { PageHeader } from "@/ui/components/PageHeader";
import { toast } from "@/ui/components/Toast";

import {
  adminBrowserApis,
  ConfirmAction,
  FormDialog,
  problemMessage,
  QueryError,
  Section,
  StatusChip,
  useActor,
} from "../console";
import { CampaignBudget } from "./CampaignBudget";
import type { Campaign, Promotion } from "./resources";
import { bangkokDayOf, bangkokMidnight } from "./time";

/** Reads the campaign with its ETag: an edit is sent under `If-Match` (`admin.campaigns.update`). */
export async function readCampaign(campaignId: string) {
  const { data, response } = await adminBrowserApis().contract.GET("/v1/admin/campaigns/{campaignId}", {
    params: { path: { campaignId } },
  });
  return { data: data!, etag: response.headers.get("ETag") };
}

/**
 * One campaign (F2 2.7, D-154): its budget against the alert threshold, what it has earned (the
 * promotion report of its promotions), the promotions it groups, and the actions its status
 * allows. Ending a campaign ends its promotions, so it restates the code and needs it retyped.
 *
 * Pausing or ending records the reason given (`OptionalReasonDto`, asked for both).
 * CONTRACT-GAP admin.campaigns — no `allowedActions` (`adminCampaignActions` decides) and no
 * new-customer count in the report.
 */
export function CampaignDetail({ campaignId }: { campaignId: string }) {
  const t = useTranslations("marketing.campaign");
  const format = useFormat();
  const en = useLocale() === "en";
  const queryClient = useQueryClient();
  const actor = useActor();
  const can = (permission: string) => actor.permissions.includes(permission);
  const key = queryKeys.detail("admin", "campaign", campaignId);
  const [action, setAction] = useState<AdminLifecycleAction | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: "", budgetAmount: "", startsOn: "", endsOn: "" });

  const query = useQuery({ queryKey: key, queryFn: async () => (await readCampaign(campaignId)).data });
  const report = useQuery({
    queryKey: queryKeys.related("admin", "campaign", campaignId, "report"),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/promotions/report", {
          params: { query: { campaignId } },
        })
      ).data!,
  });
  const promotions = useQuery({
    queryKey: queryKeys.list("admin", "promotion", { campaignId }),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/promotions", {
          params: { query: { campaignId, perPage: 100 } },
        })
      ).data!,
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

  const canManage = can("campaigns.manage");
  const actions = adminCampaignActions(campaign.status, can);
  const wording = (item: AdminLifecycleAction) => (item.resumes ? "resume" : item.action);
  const goals = Object.entries(campaign.goals ?? {});
  const metric = (value: number | string | undefined, money = false) =>
    value === undefined ? "–" : money ? format.thb(String(value)) : format.number(Number(value));
  const columns: DataTableColumn<Promotion>[] = [
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
    { id: "benefit", header: t("benefit"), cell: (row) => (en ? row.benefitSummaryEn : row.benefitSummaryTh) },
    {
      id: "status",
      header: t("status"),
      cell: (row) => <StatusChip map={PROMOTION_STATUS} value={row.status} />,
    },
    {
      id: "usage",
      header: t("usage"),
      numeric: true,
      cell: (row) => (
        <span className="text-sm">
          {t("usageValue", { count: row.usage.redemptions, amount: format.thb(row.usage.discountAmount) })}
        </span>
      ),
    },
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
            <span className="text-muted text-sm tabular-nums">{campaign.code}</span>
            <StatusChip map={CAMPAIGN_STATUS} value={campaign.status} size="md" />
            {campaign.owner ? (
              <span className="text-muted text-sm">
                {t("createdBy", { name: campaign.owner.displayName })} · <When at={campaign.createdAt} />
              </span>
            ) : null}
          </>
        }
        description={t("window", {
          from: format.date(campaign.startsAt),
          to: campaign.endsAt ? format.date(campaign.endsAt) : t("noEnd"),
        })}
        actions={
          <>
            {canManage && campaign.status !== "ended" ? (
              <Button
                variant="secondary"
                iconStart="edit"
                onClick={() => {
                  setDraft({
                    name: campaign.name,
                    budgetAmount: campaign.budgetAmount ?? "",
                    startsOn: bangkokDayOf(campaign.startsAt),
                    endsOn: bangkokDayOf(campaign.endsAt),
                  });
                  setEditing(true);
                }}
              >
                {t("edit")}
              </Button>
            ) : null}
            {actions.map((item) => (
              <Button
                key={item.action}
                variant={item.action === "end" ? "ghost" : item.action === "activate" ? "primary" : "secondary"}
                onClick={() => setAction(item)}
              >
                {t(`actions.${wording(item)}.label`)}
              </Button>
            ))}
          </>
        }
      />

      {campaign.status === "exhausted" || campaign.alertedAt ? (
        <Callout
          tone={campaign.status === "exhausted" ? "danger" : "warning"}
          title={
            campaign.status === "exhausted"
              ? t("exhausted")
              : t("alerted", { threshold: format.percent(campaign.alertThresholdPct, 0) })
          }
        >
          {campaign.alertedAt ? <When at={campaign.alertedAt} /> : null}
        </Callout>
      ) : null}

      <Section title={t("budget")} description={t("budgetNote")}>
        <div className="max-w-xl">
          <CampaignBudget campaign={campaign} />
        </div>
      </Section>

      <Section title={t("performance")} description={t("performanceNote")}>
        {report.isError ? (
          <QueryError error={report.error} onRetry={() => void report.refetch()} />
        ) : (
          <dl className="grid gap-3 sm:grid-cols-5">
            {(
              [
                ["redemptions", metric(report.data?.redemptions)],
                ["orders", metric(report.data?.orderGroups)],
                ["discount", metric(report.data?.discountAmount, true)],
                ["revenue", metric(report.data?.grossAmount, true)],
                ["customers", metric(report.data?.customers)],
              ] as const
            ).map(([name, value]) => (
              <div key={name} className="rounded-md border p-3">
                <dt className="text-muted text-xs">{t(`metrics.${name}`)}</dt>
                <dd className="text-lg font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        )}
        {goals.length > 0 ? (
          <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <Badge size="sm">{t("goals")}</Badge>
            {goals.map(([name, value]) => (
              <span key={name}>
                {name}: {typeof value === "object" ? JSON.stringify(value) : String(value)}
              </span>
            ))}
          </p>
        ) : null}
      </Section>

      <Section
        title={t("promotions")}
        actions={
          can("promotions.manage") && campaign.status !== "ended" ? (
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
          title={t(`actions.${wording(action)}.title`)}
          description={t(`actions.${wording(action)}.body`, {
            code: campaign.code,
            count: promotions.data?.meta.total ?? 0,
            spent: format.thb(campaign.spentAmount),
          })}
          confirmLabel={t(`actions.${wording(action)}.label`)}
          tone={action.action === "end" ? "destructive" : "primary"}
          confirmationPhrase={action.action === "end" ? campaign.code : undefined}
          reason={
            action.action === "activate"
              ? undefined
              : { label: t("reason"), required: true, minLength: 3, hint: t("reasonHint") }
          }
          onConfirm={async ({ reason }) => {
            try {
              const { data } = await adminBrowserApis().contract.POST(
                "/v1/admin/campaigns/{campaignId}/actions/{action}",
                {
                  params: { path: { campaignId, action: action.action } },
                  body: reason ? { reason } : {},
                },
              );
              settle(data!);
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
            const { data } = await adminBrowserApis().contract.PATCH("/v1/admin/campaigns/{campaignId}", {
              params: { path: { campaignId }, header: { "If-Match": etag ?? "" } },
              body: {
                name: draft.name.trim(),
                budgetAmount: draft.budgetAmount.trim() ? Number(draft.budgetAmount).toFixed(2) : null,
                startsAt: bangkokMidnight(draft.startsOn),
                endsAt: draft.endsOn ? bangkokMidnight(draft.endsOn, true) : null,
              },
            });
            settle(data!);
            toast.success(t("saved"));
          }}
        >
          <Field label={t("fields.name")} required>
            <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          </Field>
          <Field label={t("fields.budget")} hint={t("fields.budgetHint", { spent: format.thb(campaign.spentAmount) })}>
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
            <Field label={t("fields.endsOn")} hint={t("fields.endsOnHint")}>
              <Input
                type="date"
                value={draft.endsOn}
                onChange={(event) => setDraft({ ...draft, endsOn: event.target.value })}
              />
            </Field>
          </div>
        </FormDialog>
      ) : null}
    </div>
  );
}
